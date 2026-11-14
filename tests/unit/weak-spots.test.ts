import { describe, expect, it } from "vitest";

import { basicCards, sentences } from "@/lib/flashcards/basic";
import { doubtRange, mergeRanges, revisionPlaylist, weakTopics, type WeakSpot } from "@/lib/weak-spots/aggregate";
import type { ChapterPublic } from "@/types/contracts";

const chapter = (position: number, start: number, end: number, extra: Partial<ChapterPublic> = {}): ChapterPublic => ({
  position,
  status: "ready",
  title: `Chapter ${position}`,
  startSeconds: start,
  endSeconds: end,
  summary: "A summary of the chapter.",
  notesMarkdown: null,
  keyTerms: [],
  formulas: [],
  keyMoments: [],
  segments: [],
  checkpoint: null,
  ...extra,
});

const spot = (id: string, position: number | null, start: number, end: number, source: WeakSpot["source"], label = "x"): WeakSpot => ({
  id,
  chapterPosition: position,
  label,
  startSeconds: start,
  endSeconds: end,
  source,
  resolvedAt: null,
  createdAt: "2026-11-13T00:00:00Z",
});

describe("weak topics", () => {
  it("merges overlapping and nearby ranges", () => {
    expect(
      mergeRanges([
        { startSeconds: 55, endSeconds: 60 },
        { startSeconds: 0, endSeconds: 20 },
        { startSeconds: 25, endSeconds: 40 },
      ]),
    ).toEqual([
      { startSeconds: 0, endSeconds: 40 },
      { startSeconds: 55, endSeconds: 60 },
    ]);
  });

  it("keeps a doubt window inside its chapter", () => {
    expect(doubtRange(130, { startSeconds: 100, endSeconds: 300 })).toEqual({ startSeconds: 100, endSeconds: 145 });
    expect(doubtRange(295, { startSeconds: 100, endSeconds: 300 })).toEqual({ startSeconds: 235, endSeconds: 300 });
  });

  it("groups by chapter, ranks by weight and skips resolved spots", () => {
    const chapters = [chapter(0, 0, 100), chapter(1, 100, 200)];
    const topics = weakTopics(
      [
        spot("a", 0, 10, 20, "doubt"),
        spot("b", 1, 120, 140, "manual", "Eigenvalues"),
        { ...spot("c", 1, 150, 160, "quiz"), resolvedAt: "2026-11-13T00:00:00Z" },
      ],
      chapters,
      {},
    );
    expect(topics.map((t) => t.key)).toEqual(["1", "0"]);
    expect(topics[0]?.labels).toEqual(["Eigenvalues"]);
    expect(topics[0]?.spotIds).toEqual(["b"]);
  });

  it("counts a wrong checkpoint unless a stored checkpoint spot covers the chapter", () => {
    const q = { id: "00000000-0000-4000-8000-000000000001", concept: "Limits", prompt: "?", options: ["a", "b", "c", "d"], atSeconds: null };
    const chapters = [chapter(0, 0, 100, { checkpoint: q })];
    const wrong = { [q.id]: { isCorrect: false } };
    const synthetic = weakTopics([], chapters, wrong);
    expect(synthetic).toHaveLength(1);
    expect(synthetic[0]?.synthetic).toBe(true);
    expect(synthetic[0]?.labels).toEqual(["Limits"]);

    const resolved = { ...spot("s", 0, 0, 100, "checkpoint"), resolvedAt: "2026-11-13T00:00:00Z" };
    expect(weakTopics([resolved], chapters, wrong)).toHaveLength(0);
  });

  it("builds one playlist in lecture order", () => {
    const chapters = [chapter(0, 0, 100), chapter(1, 100, 200)];
    const topics = weakTopics([spot("a", 1, 150, 170, "manual"), spot("b", 0, 30, 50, "doubt")], chapters, {});
    expect(revisionPlaylist(topics)).toEqual([
      { startSeconds: 30, endSeconds: 50 },
      { startSeconds: 150, endSeconds: 170 },
    ]);
  });
});

describe("basic flashcards", () => {
  it("splits notes into plain sentences", () => {
    expect(sentences("## Heading\n- **Entropy** measures disorder in a system. It always grows.")).toEqual([
      "Entropy measures disorder in a system.",
    ]);
  });

  it("answers each key term from the notes", () => {
    const c = chapter(0, 0, 100, {
      keyTerms: ["Entropy"],
      formulas: ["S = k \ln W"],
      notesMarkdown: "Heat flows from hot to cold bodies. **Entropy** measures how spread out energy is.",
    });
    const cards = basicCards(c);
    expect(cards[0]).toMatchObject({ front: "Entropy", back: "Entropy measures how spread out energy is.", kind: "term" });
    expect(cards[1]).toMatchObject({ kind: "formula", back: "$S = k \ln W$" });
  });
});
