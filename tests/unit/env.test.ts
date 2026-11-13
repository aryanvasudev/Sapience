import { describe, expect, it } from "vitest";

import { parseServerEnv } from "@/env";

const BASE = {
  SUPABASE_SECRET_KEY: "sb_secret_test",
  YOUTUBE_API_KEY: "yt-test",
  INTERNAL_JOB_SECRET: "x".repeat(32),
};

describe("parseServerEnv", () => {
  it("setup A (free Gemini key) parses with defaults", () => {
    const env = parseServerEnv({ ...BASE, GOOGLE_GENERATIVE_AI_API_KEY: "g-test" });
    expect(env.AI_TEXT_PROVIDER).toBe("gemini");
    expect(env.AI_VIDEO_PROVIDER).toBe("gemini");
    expect(env.GEMINI_MODEL).toBe("gemini-3.8-flash");
    expect(env.TUTOR_CLIP_MODE).toBe("on_demand");
    expect(env.LESSONS_DAILY_LIMIT_PER_USER).toBe(2);
    expect(env.LESSON_OUTLINE_FPS).toBe(0.25);
    expect(env.ADMIN_EMAILS).toEqual([]);
  });

  it("setup A without a Gemini key fails at boot", () => {
    expect(() => parseServerEnv(BASE)).toThrow(/GOOGLE_GENERATIVE_AI_API_KEY/);
  });

  it("setup B (OpenRouter only) requires the key and all three model IDs", () => {
    const b = { ...BASE, AI_TEXT_PROVIDER: "openrouter", AI_VIDEO_PROVIDER: "openrouter" };
    expect(() => parseServerEnv(b)).toThrow(/OPENROUTER_API_KEY/);
    expect(() => parseServerEnv({ ...b, OPENROUTER_API_KEY: "or" })).toThrow(/OPENROUTER_MODEL/);
    const env = parseServerEnv({
      ...b,
      OPENROUTER_API_KEY: "or",
      OPENROUTER_MODEL: "m",
      OPENROUTER_LITE_MODEL: "l",
      OPENROUTER_VIDEO_MODEL: "v",
    });
    expect(env.AI_VIDEO_PROVIDER).toBe("openrouter");
  });

  it("setup C (free text models, no video) needs no Gemini key", () => {
    const env = parseServerEnv({
      ...BASE,
      AI_TEXT_PROVIDER: "openrouter",
      AI_VIDEO_PROVIDER: "none",
      OPENROUTER_API_KEY: "or",
      OPENROUTER_MODEL: "m:free",
      OPENROUTER_LITE_MODEL: "l:free",
    });
    expect(env.AI_VIDEO_PROVIDER).toBe("none");
    expect(env.GOOGLE_GENERATIVE_AI_API_KEY).toBeUndefined();
  });

  it("setup D (split) needs both keys", () => {
    const d = {
      ...BASE,
      AI_TEXT_PROVIDER: "openrouter",
      AI_VIDEO_PROVIDER: "gemini",
      OPENROUTER_API_KEY: "or",
      OPENROUTER_MODEL: "m",
      OPENROUTER_LITE_MODEL: "l",
    };
    expect(() => parseServerEnv(d)).toThrow(/GOOGLE_GENERATIVE_AI_API_KEY/);
    expect(parseServerEnv({ ...d, GOOGLE_GENERATIVE_AI_API_KEY: "g" }).AI_TEXT_PROVIDER).toBe("openrouter");
  });

  it("rejects unknown providers, short job secrets and bad BYOK keys", () => {
    const a = { ...BASE, GOOGLE_GENERATIVE_AI_API_KEY: "g" };
    expect(() => parseServerEnv({ ...a, AI_TEXT_PROVIDER: "openai" })).toThrow(/AI_TEXT_PROVIDER/);
    expect(() => parseServerEnv({ ...a, INTERNAL_JOB_SECRET: "short" })).toThrow(/INTERNAL_JOB_SECRET/);
    expect(() => parseServerEnv({ ...a, BYOK_ENCRYPTION_KEY: Buffer.alloc(16).toString("base64") })).toThrow(
      /BYOK_ENCRYPTION_KEY/,
    );
    expect(parseServerEnv({ ...a, BYOK_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64") }).BYOK_ENCRYPTION_KEY).toBeDefined();
  });

  it("treats empty strings as unset and parses lists and numbers", () => {
    const env = parseServerEnv({
      ...BASE,
      GOOGLE_GENERATIVE_AI_API_KEY: "g",
      OPENROUTER_API_KEY: "",
      APP_INTERNAL_URL: "",
      AI_MAX_CONCURRENT_JOBS: "3",
      ADMIN_EMAILS: " A@x.com, b@y.org ,",
    });
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
    expect(env.APP_INTERNAL_URL).toBeUndefined();
    expect(env.AI_MAX_CONCURRENT_JOBS).toBe(3);
    expect(env.ADMIN_EMAILS).toEqual(["a@x.com", "b@y.org"]);
  });
});
