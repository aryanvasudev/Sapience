import { z } from "zod";

import {
  AI_TEXT_PROVIDERS,
  AI_VIDEO_PROVIDERS,
  LESSON_BUILD_MODES,
  MEDIA_RESOLUTIONS,
  TUTOR_CLIP_MODES,
} from "@/config/enums";

import { emptyToUndefined, optionalString, parseOrThrow } from "./env-client";

/**
 * Environment validation (Section 4). Split into:
 *  - `clientEnv` (in `env-client.ts`, re-exported here): NEXT_PUBLIC_* values, safe for the
 *    browser. Client code imports `@/env-client` so its bundle never includes the server schema.
 *  - `serverEnv()`: secrets and server config. Throws if called in the browser. Parsed once and
 *    validated at boot from `src/instrumentation.ts`, so a bad config fails fast.
 */

const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());
const int = (def: number, min = 0) => z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).default(def));
const positive = (def: number) => z.preprocess(emptyToUndefined, z.coerce.number().positive().default(def));

// ---------------------------------------------------------------------------
// Client: lives in env-client.ts so browser bundles never include the server schema.
// ---------------------------------------------------------------------------

export { clientEnv, ClientEnvSchema, type ClientEnv } from "./env-client";

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export const ServerEnvSchema = z
  .object({
    SUPABASE_SECRET_KEY: z.string().min(1),
    YOUTUBE_API_KEY: z.string().min(1),

    AI_TEXT_PROVIDER: z.enum(AI_TEXT_PROVIDERS).default("gemini"),
    AI_VIDEO_PROVIDER: z.enum(AI_VIDEO_PROVIDERS).default("gemini"),
    GOOGLE_GENERATIVE_AI_API_KEY: optionalString,
    GEMINI_MODEL: z.string().min(1).default("gemini-3.8-flash"),
    GEMINI_LITE_MODEL: z.string().min(1).default("gemini-3.5-flash-lite"),
    OPENROUTER_API_KEY: optionalString,
    OPENROUTER_MODEL: optionalString,
    OPENROUTER_LITE_MODEL: optionalString,
    OPENROUTER_VIDEO_MODEL: optionalString,
    AI_MAX_CONCURRENT_JOBS: int(2, 1),
    BYOK_ENCRYPTION_KEY: optionalString,
    PROMPT_VERSION: z.string().min(1).default("v3"),
    INTERNAL_JOB_SECRET: z.string().min(32, "INTERNAL_JOB_SECRET must be at least 32 characters"),
    APP_INTERNAL_URL: optionalUrl,
    VERCEL_URL: optionalString,
    VERCEL_AUTOMATION_BYPASS_SECRET: optionalString,
    ADMIN_EMAILS: z.preprocess(
      (v) =>
        typeof v === "string"
          ? v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
          : [],
      z.array(z.email()),
    ),

    LESSON_BUILD_MODE: z.enum(LESSON_BUILD_MODES).default("captions"),
    /** youtube-transcript.ai key: transcripts when YouTube refuses this server's caption lookup. */
    YOUTUBE_TRANSCRIPT_AI_KEY: optionalString,
    LESSON_MAX_VIDEO_MINUTES: int(90, 1),
    LESSON_SINGLE_PASS_MAX_MINUTES: int(15, 1),
    LESSON_BATCH_MAX_MINUTES: int(15, 1),
    LESSON_OUTLINE_FPS: positive(0.25),
    LESSON_DETAIL_FPS: positive(0.5),

    TUTOR_CLIP_MODE: z.enum(TUTOR_CLIP_MODES).default("on_demand"),
    TUTOR_CLIP_BEFORE_SECONDS: int(90),
    TUTOR_CLIP_AFTER_SECONDS: int(20),
    TUTOR_CLIP_RESOLUTION: z.enum(MEDIA_RESOLUTIONS).default("MEDIA_RESOLUTION_MEDIUM"),
    TUTOR_CLIP_TIMEOUT_MS: int(15000, 1000),

    LESSONS_DAILY_LIMIT_PER_USER: int(2),
    LESSONS_DAILY_LIMIT_GUEST: int(1),
    AI_DAILY_LIMIT_PER_USER: int(60),
    AI_DAILY_LIMIT_GUEST: int(20),
    GLOBAL_LESSONS_DAILY_LIMIT: int(4),
  })
  .superRefine((env, ctx) => {
    const usesGemini = env.AI_TEXT_PROVIDER === "gemini" || env.AI_VIDEO_PROVIDER === "gemini";
    const usesOpenRouter =
      env.AI_TEXT_PROVIDER === "openrouter" || env.AI_VIDEO_PROVIDER === "openrouter";

    if (usesGemini && !env.GOOGLE_GENERATIVE_AI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_GENERATIVE_AI_API_KEY"],
        message: "Required when AI_TEXT_PROVIDER or AI_VIDEO_PROVIDER is 'gemini' (free key from Google AI Studio).",
      });
    }
    if (usesOpenRouter && !env.OPENROUTER_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["OPENROUTER_API_KEY"],
        message: "Required when AI_TEXT_PROVIDER or AI_VIDEO_PROVIDER is 'openrouter'.",
      });
    }
    if (env.AI_TEXT_PROVIDER === "openrouter") {
      for (const key of ["OPENROUTER_MODEL", "OPENROUTER_LITE_MODEL"] as const) {
        if (!env[key]) {
          ctx.addIssue({ code: "custom", path: [key], message: "Required when AI_TEXT_PROVIDER is 'openrouter'." });
        }
      }
    }
    if (env.AI_VIDEO_PROVIDER === "openrouter" && !env.OPENROUTER_VIDEO_MODEL) {
      ctx.addIssue({
        code: "custom",
        path: ["OPENROUTER_VIDEO_MODEL"],
        message: "Required when AI_VIDEO_PROVIDER is 'openrouter' (must route to Gemini on Google AI Studio).",
      });
    }
    if (env.BYOK_ENCRYPTION_KEY !== undefined) {
      const bytes = Buffer.from(env.BYOK_ENCRYPTION_KEY, "base64");
      if (bytes.length !== 32) {
        ctx.addIssue({
          code: "custom",
          path: ["BYOK_ENCRYPTION_KEY"],
          message: "Must be 32 random bytes, base64-encoded (openssl rand -base64 32).",
        });
      }
    }
  });
export type ServerEnv = z.infer<typeof ServerEnvSchema>;

/** Pure parser, exported for tests. */
export function parseServerEnv(input: Record<string, string | undefined>): ServerEnv {
  return parseOrThrow(ServerEnvSchema, input, "server");
}

let serverEnvCache: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() was called in the browser. Server configuration must stay on the server.");
  }
  serverEnvCache ??= parseServerEnv(process.env);
  return serverEnvCache;
}
