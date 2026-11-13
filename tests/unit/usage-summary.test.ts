import { describe, expect, it } from "vitest";

import { perCall, summarizeCalls, type CallRow } from "@/lib/admin/summarize";

const row = (over: Partial<CallRow>): CallRow => ({
  kind: "tutor",
  provider: "gemini",
  model: "flash",
  lesson_id: null,
  byok: false,
  ok: true,
  fallback_from: null,
  input_tokens: 100,
  output_tokens: 10,
  duration_ms: 1000,
  ...over,
});

describe("summarizeCalls", () => {
  const rows = [
    row({ kind: "outline", lesson_id: "L1", input_tokens: 5000, output_tokens: 500, duration_ms: 20_000 }),
    row({ kind: "chapters", lesson_id: "L1", input_tokens: 9000, output_tokens: 3000, duration_ms: 40_000 }),
    row({ kind: "tutor", lesson_id: "L1" }),
    row({ kind: "tutor", byok: true, fallback_from: "gemini:flash", model: "lite" }),
    row({ kind: "search", ok: false, input_tokens: null, output_tokens: null, duration_ms: null }),
  ];
  const s = summarizeCalls(rows);

  it("totals every call, treating missing numbers as zero", () => {
    expect(s.total).toMatchObject({ calls: 5, ok: 4, byok: 1, fallbacks: 1, inputTokens: 14_200, outputTokens: 3520 });
  });

  it("groups by kind and model, busiest first", () => {
    expect(s.byKind.map((b) => [b.key, b.calls])).toEqual([
      ["tutor", 2],
      ["outline", 1],
      ["chapters", 1],
      ["search", 1],
    ]);
    expect(s.byModel.find((b) => b.key === "gemini:lite")?.calls).toBe(1);
  });

  it("counts only lesson-building calls per lesson", () => {
    expect(s.byLesson).toHaveLength(1);
    expect(s.byLesson[0]).toMatchObject({ key: "L1", calls: 2, inputTokens: 14_000, durationMs: 60_000 });
  });

  it("averages per call", () => {
    expect(perCall(s.byLesson[0], "outputTokens")).toBe(1750);
    expect(perCall({ ...s.total, calls: 0 }, "durationMs")).toBeNull();
  });
});
