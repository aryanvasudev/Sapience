import { describe, expect, it } from "vitest";

import { contextSourceLabel, contextSourcesLine } from "@/lib/context-sources";

describe("contextSourceLabel", () => {
  it("labels ranges with an en dash", () => {
    expect(contextSourceLabel("video_clip:11:11-13:01")).toBe("video 11:11–13:01");
    expect(contextSourceLabel("lecture_index:10:41-13:11")).toBe("lecture index 10:41–13:11");
    expect(contextSourceLabel("transcript:1:02:00-1:04:30")).toBe("transcript 1:02:00–1:04:30");
  });

  it("labels notes and fixed sources", () => {
    expect(contextSourceLabel("chapter_notes:4")).toBe("chapter 4 notes");
    expect(contextSourceLabel("general_knowledge")).toBe("general knowledge");
    expect(contextSourceLabel("lite_model")).toBe("backup model");
  });

  it("drops unknown sources", () => {
    expect(contextSourceLabel("something_else")).toBeNull();
  });
});

describe("contextSourcesLine", () => {
  it("joins labels", () => {
    expect(contextSourcesLine(["video_clip:11:11-13:01", "chapter_notes:4"])).toBe("Using: video 11:11–13:01 · chapter 4 notes");
  });

  it("says plainly when only general knowledge was used", () => {
    expect(contextSourcesLine(["general_knowledge"])).toMatch(/^General knowledge/);
  });

  it("returns null for nothing", () => {
    expect(contextSourcesLine([])).toBeNull();
    expect(contextSourcesLine(["nope"])).toBeNull();
  });
});
