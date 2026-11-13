import { describe, expect, it } from "vitest";

import { batchChapters, type BatchableChapter, type ChapterBatchPlan } from "@/lib/jobs/batching";

const MAX = 15 * 60;

/** Contiguous chapters from a list of lengths in seconds. */
function chapters(lengths: number[]): BatchableChapter[] {
  let start = 0;
  return lengths.map((length, position) => {
    const chapter = { position, startSeconds: start, endSeconds: start + length };
    start += length;
    return chapter;
  });
}

function expectInvariants(input: BatchableChapter[], batches: ChapterBatchPlan[], maxSeconds: number) {
  const byPosition = new Map(input.map((c) => [c.position, c]));
  // Every chapter lands in exactly one batch (never split, never dropped, never duplicated).
  expect(batches.flatMap((b) => b.positions).sort((a, b) => a - b)).toEqual(input.map((c) => c.position).sort((a, b) => a - b));
  for (const batch of batches) {
    const members = batch.positions.map((p) => byPosition.get(p) as BatchableChapter);
    expect(batch.positions.length).toBeGreaterThan(0);
    expect(batch.positions.length).toBeLessThanOrEqual(12);
    // The batch range is exactly the range of its chapters.
    expect(batch.startSeconds).toBe(Math.min(...members.map((c) => c.startSeconds)));
    expect(batch.endSeconds).toBe(Math.max(...members.map((c) => c.endSeconds)));
    // Within the limit, unless it is a single over-long chapter.
    if (members.length > 1) expect(batch.endSeconds - batch.startSeconds).toBeLessThanOrEqual(maxSeconds);
  }
}

describe("batchChapters", () => {
  it("groups chapters into batches of at most 15 min of video", () => {
    const input = chapters([300, 300, 300, 300, 300, 300, 300]);
    const batches = batchChapters(input, MAX);
    expect(batches).toEqual([
      { positions: [0, 1, 2], startSeconds: 0, endSeconds: 900 },
      { positions: [3, 4, 5], startSeconds: 900, endSeconds: 1800 },
      { positions: [6], startSeconds: 1800, endSeconds: 2100 },
    ]);
    expectInvariants(input, batches, MAX);
  });

  it("never splits a chapter across batches", () => {
    const input = chapters([400, 400, 400]);
    const batches = batchChapters(input, MAX);
    expect(batches.map((b) => b.positions)).toEqual([[0, 1], [2]]);
    expectInvariants(input, batches, MAX);
  });

  it("gives a single chapter longer than the limit a batch of its own", () => {
    const input = chapters([300, 1200, 300, 300]);
    const batches = batchChapters(input, MAX);
    expect(batches).toEqual([
      { positions: [0], startSeconds: 0, endSeconds: 300 },
      { positions: [1], startSeconds: 300, endSeconds: 1500 },
      { positions: [2, 3], startSeconds: 1500, endSeconds: 2100 },
    ]);
    expectInvariants(input, batches, MAX);
  });

  it("puts at most 12 chapters in a batch", () => {
    const input = chapters(Array.from({ length: 30 }, () => 20));
    const batches = batchChapters(input, MAX);
    expect(batches.map((b) => b.positions.length)).toEqual([12, 12, 6]);
    expectInvariants(input, batches, MAX);
  });

  it("sorts unsorted input by start time", () => {
    const input = chapters([300, 300, 300, 300]);
    const shuffled = [input[3], input[0], input[2], input[1]];
    const batches = batchChapters(shuffled, MAX);
    expect(batches.map((b) => b.positions)).toEqual([[0, 1, 2], [3]]);
    expectInvariants(input, batches, MAX);
    expect(shuffled.map((c) => c.position)).toEqual([3, 0, 2, 1]); // input not mutated
  });

  it("handles an empty outline and a single chapter", () => {
    expect(batchChapters([], MAX)).toEqual([]);
    expect(batchChapters(chapters([60]), MAX)).toEqual([{ positions: [0], startSeconds: 0, endSeconds: 60 }]);
  });

  it("holds its invariants for a realistic 90-minute outline", () => {
    const input = chapters([95, 410, 380, 620, 240, 180, 1100, 300, 260, 330, 450, 75, 520, 340]);
    const batches = batchChapters(input, MAX);
    expectInvariants(input, batches, MAX);
    expect(batches.find((b) => b.positions.includes(6))?.positions).toEqual([6]);
  });
});
