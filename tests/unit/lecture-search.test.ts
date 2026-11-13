import { describe, expect, it } from "vitest";

import { indexText, instantSearch, normalize, resolveRefs, snippetAround } from "@/lib/search/lecture-search";
import type { ChapterPublic } from "@/types/contracts";

const chapters: ChapterPublic[] = [
  {
    position: 0,
    status: "ready",
    title: "Eigenvalues",
    startSeconds: 0,
    endSeconds: 300,
    summary: "What eigenvalues are.",
    notesMarkdown: "",
    keyTerms: ["Eigenvector", "Characteristic polynomial"],
    formulas: [],
    keyMoments: [{ id: "c0m0", seconds: 120, label: "Definition of an eigenvalue" }],
    segments: [
      { id: "c0s0", startSeconds: 0, endSeconds: 60, speech: "Today we look at matrices and their eigenvalues.", board: null },
      { id: "c0s1", startSeconds: 60, endSeconds: 150, speech: "A v equals lambda v.", board: "$Av = \\lambda v$" },
    ],
    checkpoint: null,
  },
  {
    position: 1,
    status: "pending",
    title: "Diagonalisation",
    startSeconds: 300,
    endSeconds: 600,
    summary: null,
    notesMarkdown: null,
    keyTerms: [],
    formulas: [],
    keyMoments: [],
    segments: [],
    checkpoint: null,
  },
  {
    position: 2,
    status: "ready",
    title: "Théorème spectral",
    startSeconds: 600,
    endSeconds: 900,
    summary: null,
    notesMarkdown: "",
    keyTerms: [],
    formulas: [],
    keyMoments: [],
    segments: [{ id: "c2s0", startSeconds: 600, endSeconds: 700, speech: "Symmetric matrices have real eigenvalues.", board: null }],
    checkpoint: null,
  },
];

describe("normalize", () => {
  it("drops case and diacritics", () => {
    expect(normalize("Théorème")).toBe("theoreme");
  });
});

describe("instantSearch", () => {
  it("finds titles, terms, moments and segments, chapters first", () => {
    const hits = instantSearch(chapters, "eigen");
    expect(hits[0]).toMatchObject({ kind: "chapter", ref: "c0" });
    expect(hits.map((h) => h.kind)).toEqual(["chapter", "term", "moment", "segment", "segment"]);
  });

  it("is diacritic-insensitive", () => {
    expect(instantSearch(chapters, "theoreme")[0]).toMatchObject({ kind: "chapter", seconds: 600 });
  });

  it("searches board text", () => {
    expect(instantSearch(chapters, "\\lambda").some((h) => h.ref === "c0s1")).toBe(true);
  });

  it("ignores one-character queries", () => {
    expect(instantSearch(chapters, "a")).toEqual([]);
  });
});

describe("resolveRefs", () => {
  it("keeps only provided refs, with our own times, deduped and capped", () => {
    const results = resolveRefs(chapters, [
      { ref: "c0s1", why: "defines it" },
      { ref: "c9s9", why: "invented" },
      { ref: "c0s1", why: "duplicate" },
      { ref: "c0m0", why: "key moment" },
      { ref: "c2s0", why: "symmetric" },
      { ref: "c0s0", why: "over the cap" },
    ]);
    expect(results.map((r) => [r.ref, r.seconds])).toEqual([
      ["c0s1", 60],
      ["c0m0", 120],
      ["c2s0", 600],
    ]);
    expect(results[0].why).toBe("defines it");
  });

  it("never resolves refs in chapters that aren't ready", () => {
    expect(resolveRefs(chapters, [{ ref: "c1s0", why: "x" }])).toEqual([]);
  });
});

describe("indexText", () => {
  it("lists ready chapters' moments and segments with IDs", () => {
    const text = indexText(chapters, (s) => s);
    expect(text).toContain("c0s1 [1:00-2:30] said: A v equals lambda v.");
    expect(text).toContain("c0m0 [2:00] key moment:");
    expect(text).not.toContain("Diagonalisation");
  });
});

describe("snippetAround", () => {
  it("centres long text on the match", () => {
    const long = `${"x ".repeat(100)}needle ${"y ".repeat(100)}`;
    const s = snippetAround(long, "needle");
    expect(s).toContain("needle");
    expect(s.startsWith("…")).toBe(true);
    expect(s.length).toBeLessThanOrEqual(165);
  });
});
