import { describe, expect, it } from "vitest";

import { linesFromTranscriptApi, transcriptApiLanguages } from "@/lib/youtube/transcript-api";

describe("linesFromTranscriptApi", () => {
  it("turns segments into whole-second lines in order, dropping empty text", () => {
    const body = {
      video_id: "QnQe0xW_JY4",
      language: "en",
      length_seconds: 716,
      transcript: [
        { text: "revolutionary course in biology of all", start: 3.48, duration: 6.28 },
        { text: "if you're wondering this is how the most", start: 0.48, duration: 6.48 },
        { text: "  \n ", start: 5, duration: 1 },
        { text: "time  begins\ncome today", start: 6.96, duration: 5.2 },
      ],
    };
    expect(linesFromTranscriptApi(body)).toEqual([
      { seconds: 0, text: "if you're wondering this is how the most" },
      { seconds: 3, text: "revolutionary course in biology of all" },
      { seconds: 6, text: "time begins come today" },
    ]);
  });

  it("returns nothing for an unexpected body", () => {
    expect(linesFromTranscriptApi({ transcript: "[0.0s] plain text" })).toEqual([]);
    expect(linesFromTranscriptApi(null)).toEqual([]);
  });
});

describe("transcriptApiLanguages", () => {
  it("lets the API default for English and asks for the output language then English otherwise", () => {
    expect(transcriptApiLanguages("en")).toBeNull();
    expect(transcriptApiLanguages("hinglish")).toBe("hi,en");
    expect(transcriptApiLanguages("hi")).toBe("hi,en");
  });
});
