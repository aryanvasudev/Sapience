import { describe, expect, it } from "vitest";

import { checkpointMarks, crossedCheckpoint, endedCheckpoint, type CheckpointMark } from "@/lib/checkpoints";
import type { ChapterPublic } from "@/types/contracts";

function chapter(position: number, start: number, end: number, opts: { checkpoint?: string; status?: ChapterPublic["status"] } = {}): ChapterPublic {
  return {
    position,
    status: opts.status ?? "ready",
    title: `Chapter ${position + 1}`,
    startSeconds: start,
    endSeconds: end,
    summary: null,
    notesMarkdown: null,
    keyTerms: [],
    formulas: [],
    keyMoments: [],
    segments: [],
    checkpoint: opts.checkpoint
      ? { id: opts.checkpoint, concept: "c", prompt: "p", options: ["a", "b", "c", "d"], atSeconds: end }
      : null,
  };
}

const ID_A = "00000000-0000-4000-8000-00000000000a";
const ID_B = "00000000-0000-4000-8000-00000000000b";
const ID_C = "00000000-0000-4000-8000-00000000000c";

const marks: CheckpointMark[] = checkpointMarks([
  chapter(0, 0, 120, { checkpoint: ID_A }),
  chapter(1, 120, 300),
  chapter(2, 300, 480, { checkpoint: ID_B }),
  chapter(3, 480, 600, { checkpoint: ID_C }),
]);
const none = new Set<string>();

describe("checkpointMarks", () => {
  it("places each checkpoint at its chapter's end, skipping chapters without one", () => {
    expect(marks.map((m) => [m.questionId, m.at, m.chapterPosition])).toEqual([
      [ID_A, 120, 0],
      [ID_B, 480, 2],
      [ID_C, 600, 3],
    ]);
  });

  it("ignores chapters that aren't ready", () => {
    expect(checkpointMarks([chapter(0, 0, 60, { checkpoint: ID_A, status: "pending" })])).toEqual([]);
  });
});

describe("crossedCheckpoint", () => {
  it("fires on a natural crossing", () => {
    expect(crossedCheckpoint(marks, 119.6, 120.1, none)?.questionId).toBe(ID_A);
  });

  it("fires when the sample lands exactly on the checkpoint", () => {
    expect(crossedCheckpoint(marks, 119.5, 120, none)?.questionId).toBe(ID_A);
  });

  it("does not fire when the previous sample was already at the checkpoint", () => {
    expect(crossedCheckpoint(marks, 120, 120.5, none)).toBeNull();
  });

  it("does not fire on a seek past the checkpoint", () => {
    expect(crossedCheckpoint(marks, 100, 130, none)).toBeNull();
    expect(crossedCheckpoint(marks, 117, 120.1, none)).toBeNull(); // 3.1 s step
  });

  it("allows a 2 s step but not more", () => {
    expect(crossedCheckpoint(marks, 118.5, 120.5, none)?.questionId).toBe(ID_A);
    expect(crossedCheckpoint(marks, 118.4, 120.5, none)).toBeNull();
  });

  it("does not fire going backwards", () => {
    expect(crossedCheckpoint(marks, 121, 119, none)).toBeNull();
  });

  it("does not fire for a checkpoint already done", () => {
    expect(crossedCheckpoint(marks, 119.6, 120.1, new Set([ID_A]))).toBeNull();
  });
});

describe("endedCheckpoint", () => {
  it("returns the last chapter's checkpoint", () => {
    expect(endedCheckpoint(marks, none)?.questionId).toBe(ID_C);
  });

  it("returns nothing if it already fired or was answered", () => {
    expect(endedCheckpoint(marks, new Set([ID_C]))).toBeNull();
  });

  it("returns nothing when there are no checkpoints", () => {
    expect(endedCheckpoint([], none)).toBeNull();
  });
});
