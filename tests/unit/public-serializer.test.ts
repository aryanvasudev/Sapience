import { describe, expect, it } from "vitest";

import { serializeLesson, toQuestionPublic, type ChapterRow, type LessonRow, type QuestionRow } from "@/lib/lessons/public-serializer";

/** What a `select *` on `questions` returns: the answer columns are on the row. */
type FullQuestionRow = QuestionRow & {
  source: string;
  lesson_id: string;
  correct_index: number;
  explanation: string;
  misconception: string | null;
  created_at: string;
};

const LESSON: LessonRow & { input_tokens: number; created_by: string } = {
  youtube_video_id: "FIXTURE0001",
  output_language: "en",
  source: "fixture",
  status: "building",
  spoken_language: "en",
  overview: "Forces and motion in one lecture.",
  input_tokens: 123456,
  created_by: "00000000-0000-4000-8000-0000000000aa",
};

const CHAPTERS: ChapterRow[] = [
  {
    // Out of order on purpose: the serializer sorts by position.
    id: "c2000000-0000-4000-8000-000000000002",
    position: 2,
    status: "pending",
    title: "Momentum",
    start_seconds: 600,
    end_seconds: 900,
    summary: "PENDING_SUMMARY_LEAK",
    notes_markdown: "PENDING_NOTES_LEAK",
    key_terms: ["PENDING_TERM_LEAK"],
    formulas: ["p = mv"],
    key_moments: [{ id: "c2m0", seconds: 650, label: "PENDING_MOMENT_LEAK" }],
    segments: [{ id: "c2s0", startSeconds: 600, endSeconds: 660, speech: "PENDING_SEGMENT_LEAK", board: null }],
  },
  {
    id: "c0000000-0000-4000-8000-000000000000",
    position: 0,
    status: "ready",
    title: "Newton's laws",
    start_seconds: 0,
    end_seconds: 300,
    summary: "The three laws.",
    notes_markdown: "## Laws\n$F = ma$",
    key_terms: ["force", "mass"],
    formulas: ["F = ma"],
    key_moments: [
      { id: "c0m0", seconds: 42.6, label: "First law" },
      { id: "c0m1", seconds: -3, label: "Clamped to zero" },
      { id: "c0m2", seconds: "60", label: "seconds is a string" },
      { seconds: 70, label: "no id" },
      { id: "c0m4", seconds: 80 },
      null,
      "junk",
      7,
    ],
    segments: [
      { id: "c0s0", startSeconds: 0, endSeconds: 60, speech: "Today: forces.", board: "F = ma" },
      { id: "c0s1", startSeconds: 60, endSeconds: 120, speech: "Second law.", board: 42 },
      { id: "c0s2", startSeconds: 120, endSeconds: 180, board: "no speech" },
      { id: "c0s3", startSeconds: "180", endSeconds: 240, speech: "string start" },
      { startSeconds: 240, endSeconds: 300, speech: "no id" },
      null,
      [],
    ],
  },
  {
    id: "c1000000-0000-4000-8000-000000000001",
    position: 1,
    status: "failed",
    title: "Friction",
    start_seconds: 300,
    end_seconds: 600,
    summary: "FAILED_SUMMARY_LEAK",
    notes_markdown: null,
    key_terms: [],
    formulas: [],
    key_moments: "not an array",
    segments: { not: "an array" },
  },
  {
    id: "c3000000-0000-4000-8000-000000000003",
    position: 3,
    status: "weird-status",
    title: "Summary",
    start_seconds: 900,
    end_seconds: 960,
    summary: null,
    notes_markdown: null,
    key_terms: [],
    formulas: [],
    key_moments: [],
    segments: [],
  },
];

const QUESTIONS: FullQuestionRow[] = [
  {
    id: "a0000000-0000-4000-8000-00000000000a",
    chapter_id: "c0000000-0000-4000-8000-000000000000",
    concept: "Newton's second law",
    prompt: "What does F = ma relate?",
    options: ["Force, mass, acceleration", "Speed and time", "Energy and work", "Pressure and area"],
    at_seconds: 300,
    source: "checkpoint",
    lesson_id: "l0000000-0000-4000-8000-000000000000",
    correct_index: 0,
    explanation: "SECRET_EXPLANATION_CH0",
    misconception: "SECRET_MISCONCEPTION_CH0",
    created_at: "2026-11-13T00:00:00Z",
  },
  {
    // Pending chapter: never exposed.
    id: "b0000000-0000-4000-8000-00000000000b",
    chapter_id: "c2000000-0000-4000-8000-000000000002",
    concept: "Momentum",
    prompt: "PENDING_QUESTION_LEAK",
    options: ["a", "b", "c", "d"],
    at_seconds: 900,
    source: "checkpoint",
    lesson_id: "l0000000-0000-4000-8000-000000000000",
    correct_index: 3,
    explanation: "SECRET_EXPLANATION_CH2",
    misconception: "SECRET_MISCONCEPTION_CH2",
    created_at: "2026-11-13T00:00:00Z",
  },
  {
    // No chapter: ignored.
    id: "c0000000-0000-4000-8000-00000000000c",
    chapter_id: null,
    concept: "Loose",
    prompt: "LOOSE_QUESTION_LEAK",
    options: ["a", "b", "c", "d"],
    at_seconds: null,
    source: "tutor_check",
    lesson_id: "l0000000-0000-4000-8000-000000000000",
    correct_index: 2,
    explanation: "SECRET_EXPLANATION_LOOSE",
    misconception: null,
    created_at: "2026-11-13T00:00:00Z",
  },
];

const SECRET_KEYS = ["correct_index", "correctIndex", "explanation", "misconception"];

function expectNoAnswers(json: string) {
  for (const key of SECRET_KEYS) expect(json).not.toContain(`"${key}"`);
  expect(json).not.toMatch(/SECRET_/);
  for (const q of QUESTIONS) {
    expect(json).not.toContain(q.explanation);
    if (q.misconception) expect(json).not.toContain(q.misconception);
  }
}

describe("serializeLesson", () => {
  const result = serializeLesson(LESSON, CHAPTERS, QUESTIONS);
  const json = JSON.stringify(result);

  it("never includes correct_index, explanation or misconception", () => {
    expectNoAnswers(json);
    // The correct index can't sneak out under another name either.
    const checkpoint = result.chapters[0].checkpoint;
    expect(checkpoint === null ? [] : Object.keys(checkpoint).sort()).toEqual(["atSeconds", "concept", "id", "options", "prompt"]);
  });

  it("exposes nothing beyond the allow-listed lesson fields", () => {
    expect(Object.keys(result).sort()).toEqual(["chapters", "language", "overview", "source", "spokenLanguage", "status", "youtubeVideoId"]);
    expect(json).not.toContain("123456");
    expect(json).not.toContain(LESSON.created_by);
  });

  it("pending, failed and unknown-status chapters expose no notes, segments or checkpoint", () => {
    expect(json).not.toMatch(/PENDING_|FAILED_|LOOSE_/);
    for (const chapter of result.chapters.filter((c) => c.status !== "ready")) {
      expect(chapter).toMatchObject({
        summary: null,
        notesMarkdown: null,
        keyTerms: [],
        formulas: [],
        keyMoments: [],
        segments: [],
        checkpoint: null,
      });
    }
  });

  it("drops malformed key moments and segments", () => {
    const ready = result.chapters[0];
    expect(ready.keyMoments).toEqual([
      { id: "c0m0", seconds: 43, label: "First law" },
      { id: "c0m1", seconds: 0, label: "Clamped to zero" },
    ]);
    expect(ready.segments).toEqual([
      { id: "c0s0", startSeconds: 0, endSeconds: 60, speech: "Today: forces.", board: "F = ma" },
      { id: "c0s1", startSeconds: 60, endSeconds: 120, speech: "Second law.", board: null },
    ]);
  });

  it("matches the snapshot of a full fixture", () => {
    expect(result).toMatchInlineSnapshot(`
      {
        "chapters": [
          {
            "checkpoint": {
              "atSeconds": 300,
              "concept": "Newton's second law",
              "id": "a0000000-0000-4000-8000-00000000000a",
              "options": [
                "Force, mass, acceleration",
                "Speed and time",
                "Energy and work",
                "Pressure and area",
              ],
              "prompt": "What does F = ma relate?",
            },
            "endSeconds": 300,
            "formulas": [
              "F = ma",
            ],
            "keyMoments": [
              {
                "id": "c0m0",
                "label": "First law",
                "seconds": 43,
              },
              {
                "id": "c0m1",
                "label": "Clamped to zero",
                "seconds": 0,
              },
            ],
            "keyTerms": [
              "force",
              "mass",
            ],
            "notesMarkdown": "## Laws
      $F = ma$",
            "position": 0,
            "segments": [
              {
                "board": "F = ma",
                "endSeconds": 60,
                "id": "c0s0",
                "speech": "Today: forces.",
                "startSeconds": 0,
              },
              {
                "board": null,
                "endSeconds": 120,
                "id": "c0s1",
                "speech": "Second law.",
                "startSeconds": 60,
              },
            ],
            "startSeconds": 0,
            "status": "ready",
            "summary": "The three laws.",
            "title": "Newton's laws",
          },
          {
            "checkpoint": null,
            "endSeconds": 600,
            "formulas": [],
            "keyMoments": [],
            "keyTerms": [],
            "notesMarkdown": null,
            "position": 1,
            "segments": [],
            "startSeconds": 300,
            "status": "failed",
            "summary": null,
            "title": "Friction",
          },
          {
            "checkpoint": null,
            "endSeconds": 900,
            "formulas": [],
            "keyMoments": [],
            "keyTerms": [],
            "notesMarkdown": null,
            "position": 2,
            "segments": [],
            "startSeconds": 600,
            "status": "pending",
            "summary": null,
            "title": "Momentum",
          },
          {
            "checkpoint": null,
            "endSeconds": 960,
            "formulas": [],
            "keyMoments": [],
            "keyTerms": [],
            "notesMarkdown": null,
            "position": 3,
            "segments": [],
            "startSeconds": 900,
            "status": "pending",
            "summary": null,
            "title": "Summary",
          },
        ],
        "language": "en",
        "overview": "Forces and motion in one lecture.",
        "source": "fixture",
        "spokenLanguage": "en",
        "status": "building",
        "youtubeVideoId": "FIXTURE0001",
      }
    `);
  });
});

describe("toQuestionPublic", () => {
  const row: FullQuestionRow = QUESTIONS[0];

  it("keeps only safe fields, even from a full row", () => {
    const pub = toQuestionPublic(row);
    expect(pub).toEqual({
      id: row.id,
      concept: row.concept,
      prompt: row.prompt,
      options: row.options,
      atSeconds: 300,
    });
    expectNoAnswers(JSON.stringify(pub));
  });

  it("rejects rows without exactly four string options", () => {
    expect(toQuestionPublic({ ...row, options: ["a", "b", "c"] })).toBeNull();
    expect(toQuestionPublic({ ...row, options: ["a", "b", "c", 4] })).toBeNull();
    expect(toQuestionPublic({ ...row, options: "abcd" })).toBeNull();
    expect(toQuestionPublic({ ...row, options: null })).toBeNull();
  });

  it("a ready chapter whose question is malformed has no checkpoint", () => {
    const lesson = serializeLesson(LESSON, [CHAPTERS[1]], [{ ...row, options: ["only one"] }]);
    expect(lesson.chapters[0].checkpoint).toBeNull();
  });
});
