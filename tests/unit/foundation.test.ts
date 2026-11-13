import { describe, expect, it } from "vitest";

import { formatDuration, formatTimestamp } from "@/lib/format";
import { safeNextPath } from "@/lib/safe-next";
import { ContextSourceSchema, parsePreferences, PreferencesSchema, TutorRequestSchema } from "@/types/contracts";

describe("safeNextPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/app/lesson/abcdefghijk?lang=en&t=90")).toBe("/app/lesson/abcdefghijk?lang=en&t=90");
  });

  it.each([
    "https://evil.example",
    "//evil.example/path",
    "/\\evil.example",
    "javascript:alert(1)",
    "app",
    "",
    undefined,
    42,
  ])("falls back for %s", (value) => {
    expect(safeNextPath(value)).toBe("/app");
  });
});

describe("formatTimestamp / formatDuration", () => {
  it("formats seconds", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(75)).toBe("1:15");
    expect(formatTimestamp(3725)).toBe("1:02:05");
    expect(formatTimestamp(-5)).toBe("0:00");
    expect(formatTimestamp(Number.NaN)).toBe("0:00");
  });

  it("formats durations", () => {
    expect(formatDuration(3000)).toBe("50 min");
    expect(formatDuration(3725)).toBe("1 h 2 min");
    expect(formatDuration(7200)).toBe("2 h");
  });
});

describe("preferences", () => {
  it("defaults everything when nothing is stored", () => {
    expect(parsePreferences({})).toEqual(PreferencesSchema.parse({}));
    expect(parsePreferences(null).pauseForCheckpoints).toBe(true);
  });

  it("keeps valid fields and drops invalid ones", () => {
    const prefs = parsePreferences({ language: "hinglish", level: "nonsense", mathDetail: "detailed", extra: 1 });
    expect(prefs.language).toBe("hinglish");
    expect(prefs.level).toBe("college");
    expect(prefs.mathDetail).toBe("detailed");
    expect(prefs).not.toHaveProperty("extra");
  });
});

describe("contracts", () => {
  it("validates a tutor request and rejects bad video IDs", () => {
    const ok = TutorRequestSchema.safeParse({
      message: "Why is DP Mn/M0?",
      youtubeVideoId: "dQw4w9WgXcQ",
      language: "en",
      timestampSeconds: 761,
      mode: "explain_differently",
      style: "simpler",
      quickAction: "lost",
    });
    expect(ok.success).toBe(true);
    expect(TutorRequestSchema.safeParse({ ...ok.data, youtubeVideoId: "short" }).success).toBe(false);
  });

  it.each([
    ["video_clip:11:11-13:01", true],
    ["lecture_index:10:41-13:11", true],
    ["chapter_notes:4", true],
    ["general_knowledge", true],
    ["video_clip:11:11", false],
    ["anything_else", false],
  ])("context source %s → %s", (value, valid) => {
    expect(ContextSourceSchema.safeParse(value).success).toBe(valid);
  });
});
