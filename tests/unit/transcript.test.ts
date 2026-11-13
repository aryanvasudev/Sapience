import { describe, expect, it } from "vitest";

import { parseTimestamp, parseTranscript, type TranscriptLine } from "@/lib/transcript/parse";
import { alignChaptersToSegments, segmentsInRange, segmentTranscript, type TranscriptSegment } from "@/lib/transcript/segment";

describe("parseTimestamp", () => {
  it.each([
    ["0:00", 0],
    ["0:05", 5],
    ["12:34", 754],
    ["59:59", 3599],
    ["1:02:03", 3723],
    ["01:02:03", 3723],
    [" 2:05 ", 125],
  ])("%s → %d", (value, seconds) => {
    expect(parseTimestamp(value)).toBe(seconds);
  });

  it.each(["1:75", "0:60", "1:60:00", "abc", "", "1:5", "123:00:00", "1.05", ":30"])("rejects %j", (value) => {
    expect(parseTimestamp(value)).toBeNull();
  });
});

describe("parseTranscript", () => {
  it("parses the one-line copy format and drops junk before the first timestamp", () => {
    const input = ["Transcript", "Search in video", "", "0:00 hello everyone", "0:04 today we talk about forces", "1:15 and then friction"].join("\n");
    expect(parseTranscript(input)).toEqual([
      { seconds: 0, text: "hello everyone" },
      { seconds: 4, text: "today we talk about forces" },
      { seconds: 75, text: "and then friction" },
    ]);
  });

  it("parses the two-line copy format, with multi-line text and screen-reader durations removed", () => {
    const input = [
      "Introduction",
      "0:00",
      "0 seconds",
      "hello everyone",
      "welcome back",
      "",
      "0:04",
      "4 seconds",
      "today we talk",
      "about forces",
      "2:05",
      "2 minutes, 5 seconds",
      "continued",
      "1:02:03",
      "1 hour, 2 minutes, 3 seconds",
      "the end",
    ].join("\r\n");
    expect(parseTranscript(input)).toEqual([
      { seconds: 0, text: "hello everyone welcome back" },
      { seconds: 4, text: "today we talk about forces" },
      { seconds: 125, text: "continued" },
      { seconds: 3723, text: "the end" },
    ]);
  });

  it("handles h:mm:ss and transcripts that move from m:ss to h:mm:ss", () => {
    const input = "58:59 almost an hour\n59:59 one more\n1:00:00 an hour\n1:00:30 later";
    expect(parseTranscript(input).map((l) => l.seconds)).toEqual([3539, 3599, 3600, 3630]);
  });

  it("keeps Hindi (Devanagari) and Hinglish text intact", () => {
    const input = "0:00\nनमस्ते दोस्तों\n0:04\nआज हम बल के बारे में पढ़ेंगे।\n0:09 toh basically force ka matlab hai";
    expect(parseTranscript(input)).toEqual([
      { seconds: 0, text: "नमस्ते दोस्तों" },
      { seconds: 4, text: "आज हम बल के बारे में पढ़ेंगे।" },
      { seconds: 9, text: "toh basically force ka matlab hai" },
    ]);
  });

  it("does not create a line for an invalid time like 1:75", () => {
    const lines = parseTranscript("0:00 first\n1:75 not a time\n2:00 second");
    expect(lines.map((l) => l.seconds)).toEqual([0, 120]);
    expect(lines.some((l) => l.seconds === 135)).toBe(false);
  });

  it("drops timestamps with no text, collapses whitespace and sorts", () => {
    const input = "0:10   b    text  \n0:05\n\n0:00 a\n0:20\n";
    expect(parseTranscript(input)).toEqual([
      { seconds: 0, text: "a" },
      { seconds: 10, text: "b text" },
    ]);
  });

  it("returns nothing for input without timestamps", () => {
    expect(parseTranscript("just some text\nwith no times")).toEqual([]);
    expect(parseTranscript("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

function evenly(durationSeconds: number, everySeconds: number, text: (i: number) => string): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  for (let s = 0, i = 0; s < durationSeconds; s += everySeconds, i++) lines.push({ seconds: s, text: text(i) });
  return lines;
}

function expectContiguous(segments: TranscriptSegment[], durationSeconds: number) {
  expect(segments.length).toBeGreaterThan(0);
  expect(segments[0].startSeconds).toBe(0);
  expect(segments[segments.length - 1].endSeconds).toBe(durationSeconds);
  for (let i = 0; i < segments.length; i++) {
    expect(segments[i].endSeconds).toBeGreaterThan(segments[i].startSeconds);
    expect(segments[i].board).toBeNull();
    if (i > 0) expect(segments[i].startSeconds).toBe(segments[i - 1].endSeconds);
  }
}

describe("segmentTranscript", () => {
  it.each([
    ["without punctuation", (i: number) => `words ${i}`],
    ["with sentence ends", (i: number) => `sentence ${i}.`],
    ["in Hindi with a danda", (i: number) => `वाक्य ${i}।`],
  ])("makes contiguous 30–90 s segments from evenly spaced lines (%s)", (_label, text) => {
    const segments = segmentTranscript(evenly(600, 5, text), 600);
    expectContiguous(segments, 600);
    for (const s of segments) {
      expect(s.endSeconds - s.startSeconds).toBeGreaterThanOrEqual(30);
      expect(s.endSeconds - s.startSeconds).toBeLessThanOrEqual(90);
    }
  });

  // BUG (minor): segment.ts never merges a short trailing group. With lines every 5 s and a
  // 610 s video the groups start at 0, 75, …, 525, 600, so the last segment is 600–610 (10 s),
  // below the 30 s minimum of Section 5.8 (merging it would give an 85 s segment).
  it("does not leave a trailing segment shorter than 30 s for evenly spaced lines", () => {
    const segments = segmentTranscript(evenly(610, 5, (i) => `words ${i}`), 610);
    expectContiguous(segments, 610);
    for (const s of segments) {
      expect(s.endSeconds - s.startSeconds).toBeGreaterThanOrEqual(30);
      expect(s.endSeconds - s.startSeconds).toBeLessThanOrEqual(90);
    }
  });

  it("keeps every line's words, in order", () => {
    const lines = evenly(300, 5, (i) => `w${i}`);
    const speech = segmentTranscript(lines, 300)
      .map((s) => s.speech)
      .join(" ");
    expect(speech).toBe(lines.map((l) => l.text).join(" "));
  });

  it("starts the first segment at 0 even if speech starts later", () => {
    const segments = segmentTranscript([{ seconds: 12, text: "late start." }, { seconds: 50, text: "more" }], 120);
    expect(segments[0].startSeconds).toBe(0);
    expectContiguous(segments, 120);
  });

  it("never produces speech longer than 1500 characters", () => {
    const segments = segmentTranscript(evenly(600, 5, (i) => `${i} ${"x".repeat(400)}`), 600);
    expectContiguous(segments, 600);
    for (const s of segments) expect(s.speech.length).toBeLessThanOrEqual(1500);
    const huge = segmentTranscript([{ seconds: 0, text: "y".repeat(5000) }], 60);
    expect(huge[0].speech.length).toBeLessThanOrEqual(1500);
  });

  it("ignores lines at or past the duration", () => {
    const lines = [...evenly(300, 5, (i) => `w${i}`), { seconds: 300, text: "AT_END" }, { seconds: 420, text: "AFTER_END" }];
    const segments = segmentTranscript(lines, 300);
    expectContiguous(segments, 300);
    expect(segments.map((s) => s.speech).join(" ")).not.toMatch(/AT_END|AFTER_END/);
  });

  it("returns nothing for an empty transcript", () => {
    expect(segmentTranscript([], 600)).toEqual([]);
  });
});

describe("segmentsInRange", () => {
  const segments = [0, 60, 120, 180].map((s) => ({ startSeconds: s, endSeconds: s + 60 }));
  it("selects segments whose start is in [start, end)", () => {
    expect(segmentsInRange(segments, 60, 180).map((s) => s.startSeconds)).toEqual([60, 120]);
    expect(segmentsInRange(segments, 50, 61).map((s) => s.startSeconds)).toEqual([60]);
    expect(segmentsInRange(segments, 240, 300)).toEqual([]);
  });
});

describe("alignChaptersToSegments", () => {
  const DURATION = 600;
  const segments = segmentTranscript(evenly(DURATION, 5, (i) => `sentence ${i}.`), DURATION); // 60 s segments
  const starts = new Set(segments.map((s) => s.startSeconds));

  function expectAligned(chapters: { startSeconds: number; endSeconds: number }[]) {
    expect(chapters[0].startSeconds).toBe(0);
    expect(chapters[chapters.length - 1].endSeconds).toBe(DURATION);
    for (let i = 0; i < chapters.length; i++) {
      expect(starts.has(chapters[i].startSeconds)).toBe(true);
      expect(chapters[i].endSeconds).toBeGreaterThan(chapters[i].startSeconds);
      if (i > 0) expect(chapters[i].startSeconds).toBe(chapters[i - 1].endSeconds);
    }
    // Every segment sits inside exactly one chapter.
    for (const s of segments) {
      expect(chapters.filter((c) => s.startSeconds >= c.startSeconds && s.endSeconds <= c.endSeconds)).toHaveLength(1);
    }
  }

  it("snaps every boundary to the nearest segment start and keeps chapters contiguous", () => {
    const aligned = alignChaptersToSegments(
      [
        { title: "A", startSeconds: 5, endSeconds: 170 },
        { title: "B", startSeconds: 170, endSeconds: 410 },
        { title: "C", startSeconds: 410, endSeconds: 590 },
      ],
      segments,
      DURATION,
    );
    expect(aligned).toEqual([
      { title: "A", startSeconds: 0, endSeconds: 180 },
      { title: "B", startSeconds: 180, endSeconds: 420 },
      { title: "C", startSeconds: 420, endSeconds: 600 },
    ]);
    expectAligned(aligned);
  });

  it("drops chapters that collapse onto the same segment start", () => {
    const aligned = alignChaptersToSegments(
      [
        { title: "A", startSeconds: 0, endSeconds: 100 },
        { title: "B", startSeconds: 100, endSeconds: 130 },
        { title: "C", startSeconds: 130, endSeconds: 600 },
      ],
      segments,
      DURATION,
    );
    expect(aligned.map((c) => c.title)).toEqual(["A", "C"]);
    expectAligned(aligned);
  });

  it("returns chapters unchanged when there are no segments", () => {
    const chapters = [{ startSeconds: 3, endSeconds: 50 }];
    expect(alignChaptersToSegments(chapters, [], 60)).toBe(chapters);
  });
});
