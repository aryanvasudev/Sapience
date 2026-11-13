import { describe, expect, it } from "vitest";

import type { ChapterDetail, Checkpoint, FullLesson, LessonSegment, Outline } from "@/lib/ai/schemas/lesson";
import { isValidLatex, validateChapterDetail, validateOutline } from "@/lib/ai/validate-lesson";
import { validateBatch } from "@/lib/jobs/runners/chapters";
import { validateFullLesson } from "@/lib/jobs/runners/full";

type Span = [start: number, end: number];

function outline(spans: Span[]): Outline {
  return {
    spokenLanguage: "en",
    overview: "  An overview of the whole lecture.  ",
    chapters: spans.map(([startSeconds, endSeconds], i) => ({ title: ` Chapter ${i + 1} `, startSeconds, endSeconds })),
  };
}

const spans = (o: { chapters: { startSeconds: number; endSeconds: number }[] }): Span[] =>
  o.chapters.map((c) => [c.startSeconds, c.endSeconds]);

function expectOk<T>(result: { ok: true; value: T } | { ok: false; problems: string[] }): T {
  if (!result.ok) throw new Error(`expected ok, got problems:\n${result.problems.join("\n")}`);
  return result.value;
}

function expectProblems(result: { ok: true } | { ok: false; problems: string[] }): string[] {
  if (result.ok) throw new Error("expected problems, got ok");
  return result.problems;
}

describe("validateOutline", () => {
  const DURATION = 1200;

  it("accepts a clean outline and trims titles and overview", () => {
    const value = expectOk(validateOutline(outline([[0, 400], [400, 800], [800, 1200]]), DURATION));
    expect(spans(value)).toEqual([[0, 400], [400, 800], [800, 1200]]);
    expect(value.chapters.map((c) => c.title)).toEqual(["Chapter 1", "Chapter 2", "Chapter 3"]);
    expect(value.overview).toBe("An overview of the whole lecture.");
  });

  it("sorts chapters by start time", () => {
    const value = expectOk(validateOutline(outline([[800, 1200], [0, 400], [400, 800]]), DURATION));
    expect(spans(value)).toEqual([[0, 400], [400, 800], [800, 1200]]);
    expect(value.chapters.map((c) => c.title)).toEqual(["Chapter 2", "Chapter 3", "Chapter 1"]);
  });

  it("does not mutate its input", () => {
    const input = outline([[10, 400], [403, 800], [800, 1190]]);
    const copy = structuredClone(input);
    validateOutline(input, DURATION);
    expect(input).toEqual(copy);
  });

  it("snaps gaps and overlaps of up to 5 s shut", () => {
    const value = expectOk(validateOutline(outline([[0, 400], [405, 800], [795, 1200]]), DURATION));
    expect(spans(value)).toEqual([[0, 400], [400, 800], [800, 1200]]);
  });

  it("reports a gap larger than 5 s", () => {
    const problems = expectProblems(validateOutline(outline([[0, 400], [406, 800], [800, 1200]]), DURATION));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/gap from 6:40 to 6:46/);
  });

  it("reports an overlap larger than 5 s", () => {
    const problems = expectProblems(validateOutline(outline([[0, 400], [380, 800], [800, 1200]]), DURATION));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/overlap/);
  });

  it("snaps a first chapter starting within 30 s to 0:00", () => {
    expect(spans(expectOk(validateOutline(outline([[30, 400], [400, 1200]]), DURATION)))).toEqual([[0, 400], [400, 1200]]);
    expect(spans(expectOk(validateOutline(outline([[12, 400], [400, 1200]]), DURATION)))).toEqual([[0, 400], [400, 1200]]);
  });

  it("reports a first chapter starting after 30 s", () => {
    const problems = expectProblems(validateOutline(outline([[31, 400], [400, 1200]]), DURATION));
    expect(problems.join("\n")).toMatch(/first chapter must start at 0:00 \(it starts at 0:31\)/);
  });

  it("clamps a last chapter that runs past the end of the video", () => {
    expect(spans(expectOk(validateOutline(outline([[0, 600], [600, 1500]]), DURATION)))).toEqual([[0, 600], [600, 1200]]);
  });

  it("extends a last chapter that stops just short of the end", () => {
    // Tail of 25 s ≤ max(30 s, 5 % of the video).
    expect(spans(expectOk(validateOutline(outline([[0, 600], [600, 1175]]), DURATION)))).toEqual([[0, 600], [600, 1200]]);
    // 5 % of a 2 h video is 360 s.
    expect(spans(expectOk(validateOutline(outline([[0, 3600], [3600, 6900]]), 7200)))).toEqual([[0, 3600], [3600, 7200]]);
  });

  it("reports chapters that stop well before the end of the video", () => {
    const problems = expectProblems(validateOutline(outline([[0, 600], [600, 1000]]), DURATION));
    expect(problems.join("\n")).toMatch(/stop at 16:40 but the video is 20:00 long/);
  });

  it("reports a chapter that starts after the video ends, and one that ends before it starts", () => {
    expect(expectProblems(validateOutline(outline([[0, 600], [600, 1200], [1250, 1300]]), DURATION)).join("\n")).toMatch(
      /starts at 20:50, after the video ends/,
    );
    expect(expectProblems(validateOutline(outline([[0, 600], [600, 500]]), DURATION)).join("\n")).toMatch(/ends before it starts/);
  });

  it("merges a short middle chapter into the previous one by default", () => {
    const value = expectOk(validateOutline(outline([[0, 300], [300, 330], [330, 1200]]), DURATION));
    expect(spans(value)).toEqual([[0, 330], [330, 1200]]);
    expect(value.chapters.map((c) => c.title)).toEqual(["Chapter 1", "Chapter 3"]);
  });

  it("merges a short first chapter with the next one and a short last chapter into the previous one", () => {
    expect(spans(expectOk(validateOutline(outline([[0, 30], [30, 600], [600, 1200]]), DURATION)))).toEqual([[0, 600], [600, 1200]]);
    expect(spans(expectOk(validateOutline(outline([[0, 600], [600, 1170], [1170, 1200]]), DURATION)))).toEqual([[0, 600], [600, 1200]]);
  });

  it("every merged chapter is at least 60 s and the result stays contiguous", () => {
    const value = expectOk(validateOutline(outline([[0, 100], [100, 120], [120, 140], [140, 700], [700, 710], [710, 1200]]), DURATION));
    const result = spans(value);
    expect(result[0][0]).toBe(0);
    expect(result[result.length - 1][1]).toBe(DURATION);
    for (let i = 0; i < result.length; i++) {
      expect(result[i][1] - result[i][0]).toBeGreaterThanOrEqual(60);
      if (i > 0) expect(result[i][0]).toBe(result[i - 1][1]);
    }
  });

  it("with mergeShort:false reports short chapters instead of merging them", () => {
    const problems = expectProblems(validateOutline(outline([[0, 300], [300, 330], [330, 1200]]), DURATION, { mergeShort: false }));
    expect(problems).toEqual([expect.stringMatching(/"Chapter 2" is shorter than 60 seconds/)]);
    expect(expectOk(validateOutline(outline([[0, 600], [600, 1200]]), DURATION, { mergeShort: false })).chapters).toHaveLength(2);
  });

  it("allows short chapters when the video is shorter than 3 minutes", () => {
    const value = expectOk(validateOutline(outline([[0, 20], [20, 50], [50, 150]]), 150));
    expect(spans(value)).toEqual([[0, 20], [20, 50], [50, 150]]);
    expect(validateOutline(outline([[0, 20], [20, 150]]), 150, { mergeShort: false }).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------

const BOUNDS = { startSeconds: 300, endSeconds: 600 };

function checkpoint(options: string[] = ["Alpha", "Beta", "Gamma", "Delta"]): Checkpoint {
  return {
    concept: "Main idea",
    question: "Which option is right here?",
    options,
    correctIndex: 1,
    explanation: "Because the lecturer said so.",
    misconception: null,
  };
}

function seg(startSeconds: number, endSeconds: number, speech = `speech ${startSeconds}`, board: string | null = null): LessonSegment {
  return { startSeconds, endSeconds, speech, board };
}

/** Five 60 s segments covering 300–600. */
const FULL_COVER: LessonSegment[] = [seg(300, 360), seg(360, 420), seg(420, 480), seg(480, 540), seg(540, 600)];

function detail(overrides: Partial<ChapterDetail> = {}): ChapterDetail {
  return {
    position: 2,
    summary: "  A summary of the chapter.  ",
    notesMarkdown: "  Some notes with $x^2$.  ",
    keyTerms: ["force", " force ", "mass", ""],
    formulas: ["F = ma"],
    keyMoments: [{ seconds: 400, label: " Definition " }],
    checkpoint: checkpoint(),
    segments: FULL_COVER,
    ...overrides,
  };
}

describe("validateChapterDetail", () => {
  it("accepts a clean detail and trims text, dedupes key terms", () => {
    const value = expectOk(validateChapterDetail(detail(), BOUNDS));
    expect(value.summary).toBe("A summary of the chapter.");
    expect(value.notesMarkdown).toBe("Some notes with $x^2$.");
    expect(value.keyTerms).toEqual(["force", "mass"]);
    expect(value.keyMoments).toEqual([{ seconds: 400, label: "Definition" }]);
    expect(value.segments).toHaveLength(5);
  });

  it("clamps key moments within 5 s of the chapter and drops the rest, sorted", () => {
    const value = expectOk(
      validateChapterDetail(
        detail({
          keyMoments: [
            { seconds: 603, label: "just after the end" },
            { seconds: 450, label: "middle" },
            { seconds: 296, label: "just before the start" },
            { seconds: 250, label: "previous chapter" },
            { seconds: 700, label: "next chapter" },
          ],
        }),
        BOUNDS,
      ),
    );
    expect(value.keyMoments).toEqual([
      { seconds: 300, label: "just before the start" },
      { seconds: 450, label: "middle" },
      { seconds: 600, label: "just after the end" },
    ]);
  });

  it("sorts segments, clamps them into the chapter and drops ones entirely outside", () => {
    const value = expectOk(
      validateChapterDetail(
        detail({
          segments: [seg(540, 620), seg(360, 420), seg(280, 360), seg(420, 480), seg(480, 540), seg(650, 700, "outside"), seg(100, 200, "before")],
        }),
        BOUNDS,
      ),
    );
    expect(value.segments?.map((s) => [s.startSeconds, s.endSeconds])).toEqual([
      [300, 360],
      [360, 420],
      [420, 480],
      [480, 540],
      [540, 600],
    ]);
    expect(value.segments?.map((s) => s.speech)).not.toContain("outside");
  });

  it("merges a segment shorter than 15 s into the previous one, keeping its words and board", () => {
    const value = expectOk(
      validateChapterDetail(
        detail({
          segments: [seg(300, 360, "first", "a^2"), seg(360, 370, "tiny", "b^2"), seg(370, 420, "third"), ...FULL_COVER.slice(2)],
        }),
        BOUNDS,
      ),
    );
    expect(value.segments?.[0]).toEqual({ startSeconds: 300, endSeconds: 370, speech: "first tiny", board: "a^2\nb^2" });
    expect(value.segments?.[1]).toMatchObject({ startSeconds: 370, endSeconds: 420, speech: "third" });
    expect(value.segments).toHaveLength(5);
  });

  it("normalises a blank board to null", () => {
    const value = expectOk(validateChapterDetail(detail({ segments: [seg(300, 360, "a", "   "), ...FULL_COVER.slice(1)] }), BOUNDS));
    expect(value.segments?.[0].board).toBeNull();
  });

  // BUG: validate-lesson.ts only merges a short segment into the *previous* one. A short first
  // segment has no previous segment, so it survives unmerged and nothing is reported, although
  // Section 5.3 requires every segment to be 15–120 s.
  it("never returns a segment shorter than 15 s without reporting it (short first segment)", () => {
    const result = validateChapterDetail(detail({ segments: [seg(300, 305, "intro"), seg(305, 360), ...FULL_COVER.slice(1)] }), BOUNDS);
    if (result.ok) {
      for (const s of result.value.segments ?? []) expect(s.endSeconds - s.startSeconds).toBeGreaterThanOrEqual(15);
    }
  });

  it("allows segments up to 130 s and reports longer ones", () => {
    expect(validateChapterDetail(detail({ segments: [seg(300, 425), seg(425, 550), seg(550, 600)] }), BOUNDS).ok).toBe(true);
    const problems = expectProblems(validateChapterDetail(detail({ segments: [seg(300, 440), seg(440, 540), seg(540, 600)] }), BOUNDS));
    expect(problems).toEqual([expect.stringMatching(/Chapter 3 \(5:00–10:00\): .*5:00–7:20 is longer than 120 seconds/)]);
  });

  it("reports segments that cover less than 80 % of the chapter", () => {
    const problems = expectProblems(validateChapterDetail(detail({ segments: [seg(300, 360), seg(360, 420), seg(420, 480), seg(480, 530)] }), BOUNDS));
    expect(problems).toEqual([expect.stringMatching(/cover only 77% of the chapter/)]);
    expect(validateChapterDetail(detail({ segments: [seg(300, 360), seg(360, 420), seg(420, 480), seg(480, 540)] }), BOUNDS).ok).toBe(true);
  });

  it("reports a chapter with no usable segments", () => {
    const problems = expectProblems(validateChapterDetail(detail({ segments: [seg(0, 100)] }), BOUNDS));
    expect(problems.join("\n")).toMatch(/cover only 0%/);
  });

  // BUG: coverage is the *sum* of segment lengths, so overlapping (here duplicated) segments
  // count twice. Two copies of 300–420 report 80 % coverage of a 300–600 chapter although only
  // 40 % of it is covered.
  it("does not count overlapping segments twice towards coverage", () => {
    const result = validateChapterDetail(detail({ segments: [seg(300, 420, "a"), seg(300, 420, "b")] }), BOUNDS);
    expect(result.ok).toBe(false);
  });

  it("drops formulas that KaTeX can't parse instead of failing", () => {
    const value = expectOk(
      validateChapterDetail(detail({ formulas: ["\\frac{1}{2}mv^2", "\\frac{1}{", "  ", " E = mc^2 ", "\\notacommand{x}", "x^{2"] }), BOUNDS),
    );
    expect(value.formulas).toEqual(["\\frac{1}{2}mv^2", "E = mc^2"]);
  });

  it("isValidLatex", () => {
    expect(isValidLatex("\\int_0^1 x\\,dx")).toBe(true);
    expect(isValidLatex("\\sqrt{")).toBe(false);
    expect(isValidLatex("\\begin{matrix} a & b \\end{matrix}")).toBe(true);
  });

  it("reports duplicate checkpoint options (case- and space-insensitive) and trims options", () => {
    const problems = expectProblems(validateChapterDetail(detail({ checkpoint: checkpoint(["Alpha", "Beta", " alpha ", "Delta"]) }), BOUNDS));
    expect(problems).toEqual([expect.stringMatching(/duplicate options/)]);
    const value = expectOk(validateChapterDetail(detail({ checkpoint: checkpoint([" Alpha ", "Beta", "Gamma", "Delta "]) }), BOUNDS));
    expect(value.checkpoint?.options).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
  });

  it("accepts a null checkpoint", () => {
    expect(expectOk(validateChapterDetail(detail({ checkpoint: null }), BOUNDS)).checkpoint).toBeNull();
  });

  it("segmentsFromCode skips the segment checks", () => {
    const bad = detail({ segments: [seg(300, 310)] });
    expect(validateChapterDetail(bad, BOUNDS).ok).toBe(false);
    const value = expectOk(validateChapterDetail(bad, BOUNDS, { segmentsFromCode: true }));
    expect(value.segments).toEqual([seg(300, 310)]);

    const { segments: _omit, ...withoutSegments } = detail();
    void _omit;
    const noSegments = expectOk(validateChapterDetail(withoutSegments, BOUNDS, { segmentsFromCode: true }));
    expect(noSegments).not.toHaveProperty("segments");
  });
});

// ---------------------------------------------------------------------------

describe("validateBatch", () => {
  const chapters = [
    { position: 0, title: "Intro", startSeconds: 0, endSeconds: 300 },
    { position: 1, title: "Main", startSeconds: 300, endSeconds: 600 },
  ];
  const d0 = detail({ position: 0, segments: [seg(0, 100), seg(100, 200), seg(200, 300)], keyMoments: [] });
  const d1 = detail({ position: 1 });

  it("accepts every requested position exactly once", () => {
    const value = expectOk(validateBatch([d1, d0], chapters));
    expect(value.map((d) => d.position)).toEqual([1, 0]);
  });

  it("validates each detail against its own chapter's bounds", () => {
    const wrongBounds = detail({ position: 0 }); // segments 300–600 are outside chapter 0
    const problems = expectProblems(validateBatch([wrongBounds, d1], chapters));
    expect(problems.join("\n")).toMatch(/Chapter 1 \(0:00–5:00\)/);
  });

  it("reports a missing position", () => {
    expect(expectProblems(validateBatch([d0], chapters))).toEqual(["Position 1 is missing. Return details for every requested chapter."]);
  });

  it("reports a duplicated position", () => {
    expect(expectProblems(validateBatch([d0, d1, d0], chapters))).toEqual(["Position 0 is returned twice."]);
  });

  it("reports an unrequested position", () => {
    const problems = expectProblems(validateBatch([d0, d1, detail({ position: 7 })], chapters));
    expect(problems).toEqual(["Position 7 was not requested. Only return positions 0, 1."]);
  });

  it("passes segmentsFromCode through", () => {
    const noSegments = detail({ position: 1, segments: [] });
    expect(validateBatch([d0, noSegments], chapters).ok).toBe(false);
    expect(validateBatch([d0, noSegments], chapters, { segmentsFromCode: true }).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("validateFullLesson", () => {
  function fullChapter(title: string, startSeconds: number, endSeconds: number, segments?: LessonSegment[]): FullLesson["chapters"][number] {
    const { position: _p, ...rest } = detail({
      keyMoments: [{ seconds: startSeconds + 10, label: "moment" }],
      segments: segments ?? [seg(startSeconds, Math.round((startSeconds + endSeconds) / 2)), seg(Math.round((startSeconds + endSeconds) / 2), endSeconds)],
    });
    void _p;
    return { title, startSeconds, endSeconds, ...rest };
  }

  function lesson(chapters: FullLesson["chapters"]): FullLesson {
    return { spokenLanguage: "en", overview: "A short lecture about forces.", chapters };
  }

  it("validates outline and details together and returns chapters without a position", () => {
    const value = expectOk(validateFullLesson(lesson([fullChapter("Intro", 10, 120), fullChapter("Forces", 122, 240)]), 240));
    expect(spans(value)).toEqual([[0, 120], [120, 240]]);
    for (const chapter of value.chapters) expect(chapter).not.toHaveProperty("position");
    expect(value.chapters.map((c) => c.title)).toEqual(["Intro", "Forces"]);
    expect(value.chapters[0].summary).toBe("A summary of the chapter.");
  });

  it("reports short chapters instead of merging them", () => {
    const problems = expectProblems(validateFullLesson(lesson([fullChapter("Intro", 0, 30), fullChapter("Forces", 30, 600)]), 600));
    expect(problems.join("\n")).toMatch(/"Intro" is shorter than 60 seconds/);
  });

  it("reports outline problems before detail problems", () => {
    const problems = expectProblems(validateFullLesson(lesson([fullChapter("Intro", 100, 300)]), 300));
    expect(problems.join("\n")).toMatch(/first chapter must start at 0:00/);
  });

  it("reports detail problems for each chapter", () => {
    const problems = expectProblems(
      validateFullLesson(lesson([fullChapter("Intro", 0, 300, [seg(0, 100), seg(100, 200), seg(200, 300)]), fullChapter("Forces", 300, 600, [seg(300, 330), seg(330, 360)])]), 600),
    );
    expect(problems).toEqual([expect.stringMatching(/Chapter 2 \(5:00–10:00\).*cover only 20%/)]);
  });
});
