/**
 * Provider configuration → what Sapience can do, and which models to try in which order
 * (Section 4.5). Pure: takes the parsed env, no SDK imports, unit tested for setups A–D.
 */
import type { ServerEnv } from "@/env";
import type { Capabilities } from "@/types/contracts";

export type AiProviderName = "gemini" | "openrouter";
export type ModelSpec = { provider: AiProviderName; modelId: string };

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
