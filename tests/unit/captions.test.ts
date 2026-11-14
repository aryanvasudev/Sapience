import { describe, expect, it } from "vitest";

import { parseJson3, pickCaptionTrack, type CaptionTrack } from "@/lib/youtube/captions";

const track = (languageCode: string, kind?: string): CaptionTrack => ({
  baseUrl: `https://www.youtube.com/api/timedtext?lang=${languageCode}${kind ? `&kind=${kind}` : ""}`,
  languageCode,
  ...(kind ? { kind } : {}),
});

describe("pickCaptionTrack", () => {
  it("prefers a human-made track in the output language, matching regional codes", () => {
    const tracks = [track("hi", "asr"), track("hi"), track("en-IN")];
    expect(pickCaptionTrack(tracks, "en")?.languageCode).toBe("en-IN");
  });

  it("treats Hinglish as Hindi", () => {
    const tracks = [track("en"), track("hi")];
    expect(pickCaptionTrack(tracks, "hinglish")?.languageCode).toBe("hi");
  });

  it("falls back to a human-made track in the spoken language, then the auto-generated one", () => {
    expect(pickCaptionTrack([track("de", "asr"), track("fr"), track("de")], "en")?.languageCode).toBe("de");
    const auto = pickCaptionTrack([track("de", "asr"), track("fr")], "en");
    expect(auto?.languageCode).toBe("de");
    expect(auto?.kind).toBe("asr");
  });

  it("uses any human-made track when there's no auto-generated one, and null when there are none", () => {
    expect(pickCaptionTrack([track("fr")], "en")?.languageCode).toBe("fr");
    expect(pickCaptionTrack([], "en")).toBeNull();
  });
});

describe("parseJson3", () => {
  it("joins segments, floors start times, drops empty events and sorts", () => {
    const lines = parseJson3({
      events: [
        { tStartMs: 5_900, segs: [{ utf8: "second " }, { utf8: "line\nwraps" }] },
        { tStartMs: 80, segs: [{ utf8: "first" }] },
        { tStartMs: 6_000, segs: [{ utf8: "\n" }] },
        { tStartMs: 7_000 },
        { segs: [{ utf8: "no start" }] },
      ],
    });
    expect(lines).toEqual([
      { seconds: 0, text: "first" },
      { seconds: 5, text: "second line wraps" },
    ]);
  });

  it("handles a body without events", () => {
    expect(parseJson3({})).toEqual([]);
  });
});
