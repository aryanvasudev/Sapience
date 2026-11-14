/**
 * Provider configuration → what Sapience can do, and which models to try in which order
 * (Section 4.5). Pure: takes the parsed env, no SDK imports, unit tested for setups A–D.
 */
import type { ServerEnv } from "@/env";
import type { Capabilities } from "@/types/contracts";

export type AiProviderName = "gemini" | "openrouter";
/**
 * One model to try. `byok` marks a model that runs on the student's own key (Section 4.5.4); the
 * key itself never lives on the spec, so specs stay safe to log and record.
 */
export type ModelSpec = { provider: AiProviderName; modelId: string; byok?: true };

type AiEnv = Pick<
  ServerEnv,
  | "AI_TEXT_PROVIDER"
  | "AI_VIDEO_PROVIDER"
  | "GOOGLE_GENERATIVE_AI_API_KEY"
  | "GEMINI_MODEL"
  | "GEMINI_LITE_MODEL"
  | "OPENROUTER_API_KEY"
  | "OPENROUTER_MODEL"
  | "OPENROUTER_LITE_MODEL"
  | "OPENROUTER_VIDEO_MODEL"
>;

export function capabilitiesFor(env: Pick<AiEnv, "AI_VIDEO_PROVIDER">): Capabilities {
  return {
    videoLessons: env.AI_VIDEO_PROVIDER !== "none",
    // startOffset/endOffset + fps on YouTube parts exist only on the Gemini API.
    videoClipping: env.AI_VIDEO_PROVIDER === "gemini",
    tutorClip: env.AI_VIDEO_PROVIDER === "gemini",
    agenticVideo: env.AI_VIDEO_PROVIDER !== "none",
  };
}

/**
 * Text model chain for `withFallback`: main → lite → OpenRouter (if a key is set), or
 * lite → OpenRouter lite for lite-tier tasks. Duplicates are removed.
 */
export function textModelChain(env: AiEnv, tier: "main" | "lite"): ModelSpec[] {
  const chain: ModelSpec[] = [];
  const add = (provider: AiProviderName, modelId: string | undefined) => {
    if (!modelId) return;
    if (provider === "gemini" && !env.GOOGLE_GENERATIVE_AI_API_KEY) return;
    if (provider === "openrouter" && !env.OPENROUTER_API_KEY) return;
    if (chain.some((m) => m.provider === provider && m.modelId === modelId)) return;
    chain.push({ provider, modelId });
  };

  if (env.AI_TEXT_PROVIDER === "gemini") {
    if (tier === "main") add("gemini", env.GEMINI_MODEL);
    add("gemini", env.GEMINI_LITE_MODEL);
    add("openrouter", tier === "main" ? (env.OPENROUTER_MODEL ?? env.OPENROUTER_LITE_MODEL) : env.OPENROUTER_LITE_MODEL);
  } else {
    if (tier === "main") add("openrouter", env.OPENROUTER_MODEL);
    add("openrouter", env.OPENROUTER_LITE_MODEL);
  }
  return chain;
}

/** The model that watches YouTube video, or null when `AI_VIDEO_PROVIDER=none`. */
export function videoModelSpec(env: AiEnv): ModelSpec | null {
  if (env.AI_VIDEO_PROVIDER === "gemini") return { provider: "gemini", modelId: env.GEMINI_MODEL };
  if (env.AI_VIDEO_PROVIDER === "openrouter" && env.OPENROUTER_VIDEO_MODEL) {
    return { provider: "openrouter", modelId: env.OPENROUTER_VIDEO_MODEL };
  }
  return null;
}

/**
 * Video models to try in order. On Gemini the lite model watches YouTube too, so it backs up the
 * main model when that one is out of quota or not answering; OpenRouter has one video model.
 */
export function videoModelChain(env: AiEnv): ModelSpec[] {
  const main = videoModelSpec(env);
  if (!main) return [];
  return withGeminiLite(main, env.GEMINI_LITE_MODEL);
}

function withGeminiLite(main: ModelSpec, liteModelId: string | undefined): ModelSpec[] {
  if (main.provider !== "gemini" || !liteModelId || liteModelId === main.modelId) return [main];
  return [main, { ...main, modelId: liteModelId }];
}

// ---------------------------------------------------------------------------
// Bring your own key (Section 4.5.4)
// ---------------------------------------------------------------------------

type ModelEnv = Pick<AiEnv, "GEMINI_MODEL" | "GEMINI_LITE_MODEL" | "OPENROUTER_MODEL" | "OPENROUTER_LITE_MODEL" | "OPENROUTER_VIDEO_MODEL">;

/**
 * Text chain on a student's key: only that provider's models, never the app's key, so a busy
 * personal key never spends the shared free quota. Empty when the provider has no model set.
 */
export function byokTextChain(env: ModelEnv, provider: AiProviderName, tier: "main" | "lite"): ModelSpec[] {
  const ids =
    provider === "gemini"
      ? [tier === "main" ? env.GEMINI_MODEL : undefined, env.GEMINI_LITE_MODEL]
      : [tier === "main" ? (env.OPENROUTER_MODEL ?? env.OPENROUTER_LITE_MODEL) : undefined, env.OPENROUTER_LITE_MODEL];
  const chain: ModelSpec[] = [];
  for (const modelId of ids) {
    if (modelId && !chain.some((m) => m.modelId === modelId)) chain.push({ provider, modelId, byok: true });
  }
  return chain;
}

/** Video model on a student's key: Gemini always can; OpenRouter only with a video model set. */
export function byokVideoSpec(env: ModelEnv, provider: AiProviderName): ModelSpec | null {
  if (provider === "gemini") return { provider, modelId: env.GEMINI_MODEL, byok: true };
  return env.OPENROUTER_VIDEO_MODEL ? { provider, modelId: env.OPENROUTER_VIDEO_MODEL, byok: true } : null;
}

/** Video chain on a student's key: main then lite on Gemini, never the app's key. */
export function byokVideoChain(env: ModelEnv, provider: AiProviderName): ModelSpec[] {
  const main = byokVideoSpec(env, provider);
  return main ? withGeminiLite(main, env.GEMINI_LITE_MODEL) : [];
}

/** What the app can do for a student with their own key of this provider. */
export function byokCapabilities(env: ModelEnv, provider: AiProviderName): Capabilities {
  const video = byokVideoSpec(env, provider) !== null;
  return {
    videoLessons: video,
    videoClipping: provider === "gemini",
    tutorClip: provider === "gemini",
    agenticVideo: video,
  };
}
