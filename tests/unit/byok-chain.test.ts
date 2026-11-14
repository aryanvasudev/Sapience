import { describe, expect, it } from "vitest";

import { byokCapabilities, byokTextChain, byokVideoChain, byokVideoSpec } from "@/lib/ai/capabilities";

const env = {
  GEMINI_MODEL: "gemini-main",
  GEMINI_LITE_MODEL: "gemini-lite",
  OPENROUTER_MODEL: undefined,
  OPENROUTER_LITE_MODEL: undefined,
  OPENROUTER_VIDEO_MODEL: undefined,
};

describe("bring your own key: model chains", () => {
  it("uses only the student's provider, every spec flagged byok", () => {
    expect(byokTextChain(env, "gemini", "main")).toEqual([
      { provider: "gemini", modelId: "gemini-main", byok: true },
      { provider: "gemini", modelId: "gemini-lite", byok: true },
    ]);
    expect(byokTextChain(env, "gemini", "lite")).toEqual([{ provider: "gemini", modelId: "gemini-lite", byok: true }]);
  });

  it("has nothing for OpenRouter until a model is configured", () => {
    expect(byokTextChain(env, "openrouter", "main")).toEqual([]);
    expect(byokVideoSpec(env, "openrouter")).toBeNull();
    const withModels = { ...env, OPENROUTER_LITE_MODEL: "or-lite" };
    expect(byokTextChain(withModels, "openrouter", "main")).toEqual([{ provider: "openrouter", modelId: "or-lite", byok: true }]);
  });

  it("a Gemini key can do video with clipping; an OpenRouter key never clips", () => {
    expect(byokVideoSpec(env, "gemini")).toEqual({ provider: "gemini", modelId: "gemini-main", byok: true });
    expect(byokCapabilities(env, "gemini")).toEqual({ videoLessons: true, videoClipping: true, tutorClip: true, agenticVideo: true });
    const or = byokCapabilities({ ...env, OPENROUTER_VIDEO_MODEL: "or-video" }, "openrouter");
    expect(or).toEqual({ videoLessons: true, videoClipping: false, tutorClip: false, agenticVideo: true });
  });

  it("a Gemini key's video chain is main then lite, both on the key", () => {
    expect(byokVideoChain(env, "gemini")).toEqual([
      { provider: "gemini", modelId: "gemini-main", byok: true },
      { provider: "gemini", modelId: "gemini-lite", byok: true },
    ]);
    expect(byokVideoChain(env, "openrouter")).toEqual([]);
    expect(byokVideoChain({ ...env, OPENROUTER_VIDEO_MODEL: "or-video" }, "openrouter")).toEqual([
      { provider: "openrouter", modelId: "or-video", byok: true },
    ]);
  });

  it("specs never carry the key", () => {
    for (const spec of byokTextChain(env, "gemini", "main")) expect(Object.keys(spec).sort()).toEqual(["byok", "modelId", "provider"]);
  });
});
