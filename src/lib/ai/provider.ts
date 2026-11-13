import "server-only";

/**
 * The only module that imports `@ai-sdk/google` or `@openrouter/ai-sdk-provider` (Section 4.5.1).
 * Everything else asks it for a model by role, the current capabilities, a YouTube video part and
 * per-provider options.
 */
import { createGoogleGenerativeAI, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { FilePart, generateText, LanguageModel } from "ai";

/** Request-level provider options, as accepted by generateText/streamText. */
export type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]["providerOptions"]>;

import type { MediaResolution } from "@/config/enums";
import { serverEnv } from "@/env";
import type { Capabilities } from "@/types/contracts";

import { capabilitiesFor, textModelChain, videoModelSpec, type ModelSpec } from "./capabilities";

export type { ModelSpec } from "./capabilities";

export function capabilities(): Capabilities {
  return capabilitiesFor(serverEnv());
}

/** Model chains by role. `main`/`lite` are fallback chains; `video` is a single model or null. */
export const models = {
  main: (): ModelSpec[] => textModelChain(serverEnv(), "main"),
  lite: (): ModelSpec[] => textModelChain(serverEnv(), "lite"),
  video: (): ModelSpec | null => videoModelSpec(serverEnv()),
};

let googleProvider: ReturnType<typeof createGoogleGenerativeAI> | undefined;
let openRouterProvider: ReturnType<typeof createOpenRouter> | undefined;

const YOUTUBE_URL = /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/;

/** Instantiate the SDK model for a spec. `forVideo` lets OpenRouter pass YouTube URLs through. */
export function languageModel(spec: ModelSpec, opts: { forVideo?: boolean } = {}): LanguageModel {
  const env = serverEnv();
  if (spec.provider === "gemini") {
    googleProvider ??= createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
    return googleProvider(spec.modelId);
  }
  openRouterProvider ??= createOpenRouter({ apiKey: env.OPENROUTER_API_KEY, compatibility: "strict" });
  const model = openRouterProvider(spec.modelId);
  if (!opts.forVideo) return model;
  // The OpenRouter package maps video file parts to `video_url`, but doesn't declare YouTube URLs
  // as supported, so the AI SDK would try to download the watch page. Declare them here so the URL
  // is passed through to OpenRouter (which routes it to Gemini on Google AI Studio).
  const passthrough = Object.create(model) as typeof model;
  Object.defineProperty(passthrough, "supportedUrls", {
    value: { ...(model.supportedUrls as Record<string, RegExp[]>), "video/*": [YOUTUBE_URL] },
  });
  return passthrough;
}

export type Clip = { startSeconds: number; endSeconds: number };

/**
 * A YouTube video part. Clip offsets and fps are Gemini-only (`capabilities.videoClipping`); for
 * OpenRouter the caller states the time range in the prompt instead.
 */
export function youtubePart(videoId: string, spec: ModelSpec, clip?: Clip, fps?: number): FilePart {
  const part: FilePart = {
    type: "file",
    data: `https://www.youtube.com/watch?v=${videoId}`,
    mediaType: "video/mp4",
  };
  if (spec.provider === "gemini" && (clip || fps)) {
    part.providerOptions = {
      google: {
        videoMetadata: {
          ...(clip ? { startOffset: `${clip.startSeconds}s`, endOffset: `${clip.endSeconds}s` } : {}),
          ...(fps ? { fps } : {}),
        },
      },
    };
  }
  return part;
}

export type CallTuning = {
  mediaResolution?: MediaResolution;
  thinkingLevel?: "minimal" | "low" | "medium" | "high";
  structuredOutputs?: boolean;
};

/** Request-level provider options for a spec. */
export function providerOptionsFor(spec: ModelSpec, tuning: CallTuning): ProviderOptions {
  if (spec.provider === "gemini") {
    const google: GoogleLanguageModelOptions = {};
    if (tuning.mediaResolution) google.mediaResolution = tuning.mediaResolution;
    if (tuning.thinkingLevel) google.thinkingConfig = { thinkingLevel: tuning.thinkingLevel };
    if (tuning.structuredOutputs === false) google.structuredOutputs = false;
    return { google: google as ProviderOptions[string] };
  }
  return {};
}
