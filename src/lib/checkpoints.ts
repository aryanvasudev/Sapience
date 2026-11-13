/**
 * When a checkpoint fires (Section 5.7). Pure, unit tested.
 *
 * A checkpoint sits at its chapter's end. It fires only on a natural crossing during playback
 * (`last < at ≤ current` with at most 2 s between samples), so seeking past it doesn't fire it.
 * The last chapter's checkpoint also fires when the video ends, because the player may stop a
 * fraction of a second before `endSeconds`. Each checkpoint fires at most once per page session
 * and never if the student already answered it.
 */
import type { ChapterPublic } from "@/types/contracts";

export type CheckpointMark = { questionId: string; at: number; chapterPosition: number };

/** Largest gap between two samples that still counts as playing through (not a seek). */
export const MAX_NATURAL_STEP_SECONDS = 2;

export function checkpointMarks(chapters: ChapterPublic[]): CheckpointMark[] {
  return chapters
    .filter((c) => c.status === "ready" && c.checkpoint)
    .map((c) => ({ questionId: c.checkpoint!.id, at: c.endSeconds, chapterPosition: c.position }))
    .sort((a, b) => a.at - b.at);
}

export function crossedCheckpoint(
  marks: CheckpointMark[],
  lastTime: number,
  currentTime: number,
  done: ReadonlySet<string>,
): CheckpointMark | null {
  const step = currentTime - lastTime;
  if (!(step > 0) || step > MAX_NATURAL_STEP_SECONDS) return null;
  return marks.find((m) => lastTime < m.at && m.at <= currentTime && !done.has(m.questionId)) ?? null;
}

/** On ENDED: the last chapter's checkpoint, if it hasn't fired or been answered. */
export function endedCheckpoint(marks: CheckpointMark[], done: ReadonlySet<string>): CheckpointMark | null {
  const last = marks.reduce<CheckpointMark | null>((best, m) => (!best || m.chapterPosition > best.chapterPosition ? m : best), null);
  return last && !done.has(last.questionId) ? last : null;
}
