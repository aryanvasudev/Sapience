import { APICallError, RetryError } from "ai";
import { describe, expect, it, vi } from "vitest";

import { parseServerEnv } from "@/env";
import { capabilitiesFor, textModelChain, videoModelChain, videoModelSpec, type ModelSpec } from "@/lib/ai/capabilities";
import { AiBusyError, isRateLimitError, jobErrorCode, retryAfterSeconds } from "@/lib/ai/errors";
import { withFallback } from "@/lib/ai/fallback";
import { InvalidLessonOutputError } from "@/lib/ai/generate";
import { rateLimitDelaySeconds } from "@/lib/jobs/run-job";

const BASE = {
  SUPABASE_SECRET_KEY: "sb_secret_test",
  YOUTUBE_API_KEY: "yt-test",
  INTERNAL_JOB_SECRET: "x".repeat(32),
};

const SETUP_A = parseServerEnv({ ...BASE, GOOGLE_GENERATIVE_AI_API_KEY: "g" });
const SETUP_A_WITH_OPENROUTER = parseServerEnv({
  ...BASE,
  GOOGLE_GENERATIVE_AI_API_KEY: "g",
  OPENROUTER_API_KEY: "or",
  OPENROUTER_MODEL: "or/main",
  OPENROUTER_LITE_MODEL: "or/lite",
});
const SETUP_B = parseServerEnv({
  ...BASE,
  AI_TEXT_PROVIDER: "openrouter",
  AI_VIDEO_PROVIDER: "openrouter",
  OPENROUTER_API_KEY: "or",
  OPENROUTER_MODEL: "or/main",
  OPENROUTER_LITE_MODEL: "or/lite",
  OPENROUTER_VIDEO_MODEL: "google/gemini-video",
});
const SETUP_C = parseServerEnv({
  ...BASE,
  AI_TEXT_PROVIDER: "openrouter",
  AI_VIDEO_PROVIDER: "none",
  OPENROUTER_API_KEY: "or",
  OPENROUTER_MODEL: "or/main:free",
  OPENROUTER_LITE_MODEL: "or/lite:free",
});
const SETUP_D = parseServerEnv({
  ...BASE,
  AI_TEXT_PROVIDER: "openrouter",
  AI_VIDEO_PROVIDER: "gemini",
  GOOGLE_GENERATIVE_AI_API_KEY: "g",
  OPENROUTER_API_KEY: "or",
  OPENROUTER_MODEL: "or/main",
  OPENROUTER_LITE_MODEL: "or/lite",
});

const gemini = (modelId: string): ModelSpec => ({ provider: "gemini", modelId });
const openrouter = (modelId: string): ModelSpec => ({ provider: "openrouter", modelId });

describe("capabilitiesFor (setups A–D, Section 4.5.2)", () => {
  it("A: free Gemini key — everything", () => {
    expect(capabilitiesFor(SETUP_A)).toEqual({ videoLessons: true, videoClipping: true, tutorClip: true, agenticVideo: true });
  });
  it("B: OpenRouter only — video lessons without clipping or board reading", () => {
    expect(capabilitiesFor(SETUP_B)).toEqual({ videoLessons: true, videoClipping: false, tutorClip: false, agenticVideo: true });
  });
  it("C: free text models only — no video at all", () => {
    expect(capabilitiesFor(SETUP_C)).toEqual({ videoLessons: false, videoClipping: false, tutorClip: false, agenticVideo: false });
  });
  it("D: split — video on Gemini", () => {
    expect(capabilitiesFor(SETUP_D)).toEqual({ videoLessons: true, videoClipping: true, tutorClip: true, agenticVideo: true });
  });
});

describe("textModelChain", () => {
  it("A: main → lite, no OpenRouter without a key", () => {
    expect(textModelChain(SETUP_A, "main")).toEqual([gemini("gemini-3.8-flash"), gemini("gemini-3.5-flash-lite")]);
    expect(textModelChain(SETUP_A, "lite")).toEqual([gemini("gemini-3.5-flash-lite")]);
  });

  it("A with an OpenRouter key: main → lite → OpenRouter", () => {
    expect(textModelChain(SETUP_A_WITH_OPENROUTER, "main")).toEqual([
      gemini("gemini-3.8-flash"),
      gemini("gemini-3.5-flash-lite"),
      openrouter("or/main"),
    ]);
    expect(textModelChain(SETUP_A_WITH_OPENROUTER, "lite")).toEqual([gemini("gemini-3.5-flash-lite"), openrouter("or/lite")]);
  });

  it("A with an OpenRouter key but only a lite model falls back to the OpenRouter lite model", () => {
    const env = parseServerEnv({ ...BASE, GOOGLE_GENERATIVE_AI_API_KEY: "g", OPENROUTER_API_KEY: "or", OPENROUTER_LITE_MODEL: "or/lite" });
    expect(textModelChain(env, "main")).toEqual([gemini("gemini-3.8-flash"), gemini("gemini-3.5-flash-lite"), openrouter("or/lite")]);
  });

  it("A with an OpenRouter key but no model IDs adds nothing", () => {
    const env = parseServerEnv({ ...BASE, GOOGLE_GENERATIVE_AI_API_KEY: "g", OPENROUTER_API_KEY: "or" });
    expect(textModelChain(env, "main")).toEqual([gemini("gemini-3.8-flash"), gemini("gemini-3.5-flash-lite")]);
  });

  it("B, C and D: OpenRouter main → OpenRouter lite, then Gemini lite when there's a Gemini key", () => {
    expect(textModelChain(SETUP_B, "main")).toEqual([openrouter("or/main"), openrouter("or/lite")]);
    expect(textModelChain(SETUP_B, "lite")).toEqual([openrouter("or/lite")]);
    expect(textModelChain(SETUP_C, "main")).toEqual([openrouter("or/main:free"), openrouter("or/lite:free")]);
    expect(textModelChain(SETUP_D, "main")).toEqual([openrouter("or/main"), openrouter("or/lite"), gemini("gemini-3.5-flash-lite")]);
    expect(textModelChain(SETUP_D, "lite")).toEqual([openrouter("or/lite"), gemini("gemini-3.5-flash-lite")]);
  });

  it("removes duplicates", () => {
    const sameGemini = parseServerEnv({ ...BASE, GOOGLE_GENERATIVE_AI_API_KEY: "g", GEMINI_LITE_MODEL: "gemini-3.8-flash" });
    expect(textModelChain(sameGemini, "main")).toEqual([gemini("gemini-3.8-flash")]);
    const sameOpenRouter = parseServerEnv({ ...BASE, AI_TEXT_PROVIDER: "openrouter", AI_VIDEO_PROVIDER: "none", OPENROUTER_API_KEY: "or", OPENROUTER_MODEL: "m", OPENROUTER_LITE_MODEL: "m" });
    expect(textModelChain(sameOpenRouter, "main")).toEqual([openrouter("m")]);
  });
});

describe("videoModelSpec", () => {
  it("A and D use the main Gemini model; B the OpenRouter video model; C none", () => {
    expect(videoModelSpec(SETUP_A)).toEqual(gemini("gemini-3.8-flash"));
    expect(videoModelSpec(SETUP_B)).toEqual(openrouter("google/gemini-video"));
    expect(videoModelSpec(SETUP_C)).toBeNull();
    expect(videoModelSpec(SETUP_D)).toEqual(gemini("gemini-3.8-flash"));
  });
});

describe("videoModelChain", () => {
  it("Gemini backs the main video model with the lite one; OpenRouter has one; C none", () => {
    expect(videoModelChain(SETUP_A)).toEqual([gemini("gemini-3.8-flash"), gemini("gemini-3.5-flash-lite")]);
    expect(videoModelChain(SETUP_B)).toEqual([openrouter("google/gemini-video")]);
    expect(videoModelChain(SETUP_C)).toEqual([]);
  });

  it("no duplicate when lite and main are the same model", () => {
    const same = parseServerEnv({ ...BASE, GOOGLE_GENERATIVE_AI_API_KEY: "g", GEMINI_MODEL: "m", GEMINI_LITE_MODEL: "m" });
    expect(videoModelChain(same)).toEqual([gemini("m")]);
  });
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

function apiError(statusCode: number, opts: { headers?: Record<string, string>; body?: string } = {}): APICallError {
  return new APICallError({
    message: `HTTP ${statusCode}`,
    url: "https://example.test/v1/generate",
    requestBodyValues: {},
    statusCode,
    responseHeaders: opts.headers,
    responseBody: opts.body,
  });
}

const rateLimited = (headers?: Record<string, string>, body?: string) => apiError(429, { headers, body });

function retryErrorOf(...errors: unknown[]): RetryError {
  return new RetryError({ message: "Failed after retries", reason: "maxRetriesExceeded", errors });
}

const GOOGLE_429_BODY = JSON.stringify({
  error: {
    code: 429,
    message: "You exceeded your current quota.",
    status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "30s" }],
  },
});

describe("isRateLimitError", () => {
  it("recognises 429s, quota bodies, RetryError wrappers and AiBusyError", () => {
    expect(isRateLimitError(rateLimited())).toBe(true);
    expect(isRateLimitError(apiError(400, { body: GOOGLE_429_BODY }))).toBe(true);
    expect(isRateLimitError(apiError(403, { body: "Quota exceeded for this project" }))).toBe(true);
    expect(isRateLimitError(apiError(503, { body: "rate limit reached" }))).toBe(true);
    expect(isRateLimitError(retryErrorOf(apiError(500), rateLimited()))).toBe(true);
    expect(isRateLimitError(new AiBusyError(null))).toBe(true);
  });

  it("treats an overloaded model (503 high demand, 529) as no capacity, so the chain falls back", () => {
    const highDemand = JSON.stringify({
      error: { code: 503, message: "This model is currently experiencing high demand.", status: "UNAVAILABLE" },
    });
    expect(isRateLimitError(apiError(503, { body: highDemand }))).toBe(true);
    expect(isRateLimitError(apiError(529, { body: "overloaded" }))).toBe(true);
    expect(isRateLimitError(apiError(503, { body: "upstream connect error" }))).toBe(false);
  });

  it("does not flag other errors", () => {
    expect(isRateLimitError(apiError(500, { body: "internal" }))).toBe(false);
    expect(isRateLimitError(apiError(400))).toBe(false);
    expect(isRateLimitError(retryErrorOf(rateLimited(), apiError(500)))).toBe(false); // last error wins
    expect(isRateLimitError(new Error("429 Too Many Requests"))).toBe(false);
    expect(isRateLimitError("429")).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
  });
});

describe("retryAfterSeconds", () => {
  it("reads a numeric retry-after header (rounded up)", () => {
    expect(retryAfterSeconds(rateLimited({ "retry-after": "12" }))).toBe(12);
    expect(retryAfterSeconds(rateLimited({ "retry-after": " 1.2 " }))).toBe(2);
  });

  it("reads Google's retryDelay from the body", () => {
    expect(retryAfterSeconds(rateLimited(undefined, GOOGLE_429_BODY))).toBe(30);
    expect(retryAfterSeconds(rateLimited(undefined, '{"retryDelay": "12.5s"}'))).toBe(13);
  });

  it("prefers the header, falls back to the body when the header isn't a number", () => {
    expect(retryAfterSeconds(rateLimited({ "retry-after": "5" }, GOOGLE_429_BODY))).toBe(5);
    expect(retryAfterSeconds(rateLimited({ "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" }, GOOGLE_429_BODY))).toBe(30);
  });

  it("unwraps RetryError and reads AiBusyError", () => {
    expect(retryAfterSeconds(retryErrorOf(rateLimited({ "retry-after": "7" })))).toBe(7);
    expect(retryAfterSeconds(new AiBusyError(42))).toBe(42);
    expect(retryAfterSeconds(new AiBusyError(null))).toBeNull();
  });

  it("is null when the provider didn't say", () => {
    expect(retryAfterSeconds(rateLimited())).toBeNull();
    expect(retryAfterSeconds(rateLimited({ "retry-after": "soon" }))).toBeNull();
    expect(retryAfterSeconds(new Error("x"))).toBeNull();
  });
});

describe("jobErrorCode", () => {
  const named = (name: string) => Object.assign(new Error("boom"), { name });

  it("maps errors to safe codes", () => {
    expect(jobErrorCode(rateLimited())).toBe("quota");
    expect(jobErrorCode(retryErrorOf(rateLimited()))).toBe("quota");
    expect(jobErrorCode(new AiBusyError(10))).toBe("quota");
    expect(jobErrorCode(named("AbortError"))).toBe("model_timeout");
    expect(jobErrorCode(named("TimeoutError"))).toBe("model_timeout");
    expect(jobErrorCode(named("AI_NoObjectGeneratedError"))).toBe("invalid_output");
    expect(jobErrorCode(named("AI_TypeValidationError"))).toBe("invalid_output");
    expect(jobErrorCode(named("AI_JSONParseError"))).toBe("invalid_output");
    expect(jobErrorCode(new InvalidLessonOutputError(["bad"]))).toBe("invalid_output");
    expect(jobErrorCode(apiError(403, { body: "This video is private." }))).toBe("video_unavailable");
    expect(jobErrorCode(apiError(400, { body: "The video is private." }))).toBe("video_unavailable");
    expect(jobErrorCode(apiError(400, { body: "Video unavailable" }))).toBe("video_unavailable");
    expect(jobErrorCode(apiError(504))).toBe("model_timeout");
    expect(jobErrorCode(apiError(400, { body: "DEADLINE_EXCEEDED" }))).toBe("model_timeout");
    expect(jobErrorCode(apiError(503, { body: "The service is currently unavailable." }))).toBe("unknown");
    expect(jobErrorCode(apiError(500))).toBe("unknown");
    expect(jobErrorCode(new Error("anything"))).toBe("unknown");
    expect(jobErrorCode("string")).toBe("unknown");
  });

  // Regression: "age" used to match inside "message", so most JSON error bodies became
  // video_unavailable.
  it("does not classify an ordinary 400 INVALID_ARGUMENT or a bad API key as video_unavailable", () => {
    const body = JSON.stringify({ error: { code: 400, message: "Request contains an invalid argument.", status: "INVALID_ARGUMENT" } });
    expect(jobErrorCode(apiError(400, { body }))).toBe("unknown");
    expect(jobErrorCode(apiError(400, { body: '{"error":{"message":"API key not valid. Please pass a valid API key."}}' }))).toBe("unknown");
  });

  it("never returns the raw provider message", () => {
    const code = jobErrorCode(apiError(400, { body: "secret provider detail" }));
    expect(["video_unavailable", "model_timeout", "invalid_output", "quota", "unknown"]).toContain(code);
  });
});

// ---------------------------------------------------------------------------
// withFallback
// ---------------------------------------------------------------------------

describe("withFallback", () => {
  const CHAIN = ["main", "lite", "openrouter"] as const;
  type Model = (typeof CHAIN)[number];

  it("returns the first model's answer without falling back", async () => {
    const call = vi.fn(async (model: Model) => `answer from ${model}`);
    const result = await withFallback(CHAIN, call);
    expect(result).toEqual({ value: "answer from main", model: "main", fallbackFrom: null, attempts: [] });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("429 on main → lite", async () => {
    const error = rateLimited();
    const result = await withFallback(CHAIN, async (model) => {
      if (model === "main") throw error;
      return `answer from ${model}`;
    });
    expect(result.value).toBe("answer from lite");
    expect(result.model).toBe("lite");
    expect(result.fallbackFrom).toBe("main");
    expect(result.attempts).toEqual([{ model: "main", error }]);
  });

  it("429 on main and lite → OpenRouter; fallbackFrom is the first model", async () => {
    const onRateLimited = vi.fn();
    const call = vi.fn(async (model: Model) => {
      if (model === "main") throw retryErrorOf(rateLimited());
      if (model === "lite") throw rateLimited();
      return 42;
    });
    const result = await withFallback(CHAIN, call, { onRateLimited });
    expect(result.value).toBe(42);
    expect(result.model).toBe("openrouter");
    expect(result.fallbackFrom).toBe("main");
    expect(result.attempts.map((a) => a.model)).toEqual(["main", "lite"]);
    expect(call.mock.calls.map(([m]) => m)).toEqual(["main", "lite", "openrouter"]);
    expect(onRateLimited.mock.calls.map(([m]) => m)).toEqual(["main", "lite"]);
  });

  it("does not fall back on a non-rate-limit error", async () => {
    const error = apiError(500, { body: "internal" });
    const call = vi.fn(async (model: Model) => {
      if (model === "main") throw error;
      return "should not be reached";
    });
    await expect(withFallback(CHAIN, call)).rejects.toBe(error);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("stops at a non-rate-limit error further down the chain", async () => {
    const error = new Error("schema rejected");
    const call = vi.fn(async (model: Model) => {
      if (model === "main") throw rateLimited();
      throw error;
    });
    await expect(withFallback(CHAIN, call)).rejects.toBe(error);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("all rate-limited → AiBusyError with the shortest retry-after", async () => {
    const waits: Record<Model, APICallError> = {
      main: rateLimited({ "retry-after": "60" }),
      lite: rateLimited(undefined, GOOGLE_429_BODY), // 30 s
      openrouter: rateLimited(), // unknown
    };
    const promise = withFallback(CHAIN, async (model) => {
      throw waits[model];
    });
    await expect(promise).rejects.toBeInstanceOf(AiBusyError);
    await expect(promise).rejects.toMatchObject({ retryAfterSeconds: 30, name: "AiBusyError" });
  });

  it("all rate-limited without any retry-after → AiBusyError(null)", async () => {
    await expect(
      withFallback(CHAIN, async () => {
        throw rateLimited();
      }),
    ).rejects.toMatchObject({ retryAfterSeconds: null });
  });

  it("fallBackOn lets other errors (a timeout) fall back too", async () => {
    const timeout = new DOMException("timed out", "TimeoutError");
    const result = await withFallback(
      CHAIN,
      async (model) => {
        if (model === "main") throw timeout;
        return `answer from ${model}`;
      },
      { fallBackOn: (error) => error === timeout },
    );
    expect(result.model).toBe("lite");
    expect(result.fallbackFrom).toBe("main");
  });

  it("a chain that ran out after a fallBackOn error throws that error, not AiBusyError", async () => {
    const timeout = new DOMException("timed out", "TimeoutError");
    const promise = withFallback(
      CHAIN,
      async (model) => {
        if (model === "lite") throw timeout;
        throw rateLimited();
      },
      { fallBackOn: (error) => error === timeout },
    );
    await expect(promise).rejects.toBe(timeout);
  });

  it("rejects an empty chain", async () => {
    await expect(withFallback([], async () => 1)).rejects.toThrow(/empty model chain/);
  });
});

describe("rateLimitDelaySeconds", () => {
  it("30 s doubling, capped at 5 min", () => {
    expect([0, 1, 2, 3, 4, 5, 20].map((n) => rateLimitDelaySeconds(n, null))).toEqual([30, 60, 120, 240, 300, 300, 300]);
    expect(rateLimitDelaySeconds(-1, null)).toBe(30);
  });

  it("honours retry-after, capped at 5 min and at least 1 s", () => {
    expect(rateLimitDelaySeconds(0, 45)).toBe(45);
    expect(rateLimitDelaySeconds(3, 10)).toBe(10);
    expect(rateLimitDelaySeconds(0, 1000)).toBe(300);
    expect(rateLimitDelaySeconds(0, 0)).toBe(1);
  });
});
