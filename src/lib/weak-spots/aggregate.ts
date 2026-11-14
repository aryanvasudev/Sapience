/**
 * Weak topics (pure, client-safe). A weak spot is one signal that a student struggled with part of
 * a lecture: a wrong checkpoint or quiz answer, pausing with a doubt, or marking it themselves.
 * Signals are grouped by chapter (the lecture's topics) and their time ranges merged, so a student
 * can rewatch just those parts.
 */
import type { WeakSpotSource } from "@/config/enums";
import type { ChapterPublic, LessonStatusResponse } from "@/types/contracts";

export type WeakSpot = {
  id: string;
  chapterPosition: number | null;
  label: string;
  startSeconds: number;
  endSeconds: number;
  source: WeakSpotSource;
  resolvedAt: string | null;
  createdAt: string;
};

export type TimeRange = { startSeconds: number; endSeconds: number };

export type WeakTopic = {
  /** Chapter position as a string, or "other". */
  key: string;
  chapterPosition: number | null;
  title: string;
  /** Higher is weaker. */
  score: number;
  sources: Partial<Record<WeakSpotSource, number>>;
  /** Distinct concepts behind the signals (quiz concepts, the student's own labels). */
  labels: string[];
  ranges: TimeRange[];
  spotIds: string[];
  /** Only a wrong checkpoint from before weak spots were stored: nothing to resolve in the database. */
  synthetic: boolean;
};

export const SOURCE_WEIGHT: Record<WeakSpotSource, number> = { manual: 3, checkpoint: 2, quiz: 2, doubt: 1 };

export const SOURCE_LABEL: Record<WeakSpotSource, string> = {
  checkpoint: "Checkpoint",
  quiz: "Quiz",
  doubt: "Doubt",
  manual: "Marked by you",
};

/** Ranges closer than this are merged into one. */
const MERGE_GAP_SECONDS = 10;

export function mergeRanges(ranges: TimeRange[], gap = MERGE_GAP_SECONDS): TimeRange[] {
  const sorted = ranges
    .filter((r) => r.endSeconds > r.startSeconds)
    .map((r) => ({ ...r }))
    .sort((a, b) => a.startSeconds - b.startSeconds);
  const merged: TimeRange[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.startSeconds <= last.endSeconds + gap) last.endSeconds = Math.max(last.endSeconds, r.endSeconds);
    else merged.push(r);
  }
  return merged;
}

/** The window rewatched for a doubt raised at `seconds`: the minute before it, inside its chapter. */
export function doubtRange(seconds: number, chapter: Pick<ChapterPublic, "startSeconds" | "endSeconds"> | null): TimeRange {
  const t = Math.max(0, Math.floor(seconds));
  const lo = chapter ? chapter.startSeconds : 0;
  const hi = chapter ? chapter.endSeconds : t + 15;
  const start = Math.max(lo, t - 60);
  const end = Math.min(hi, Math.max(t + 15, start + 20));
  return end > start ? { startSeconds: start, endSeconds: end } : { startSeconds: t, endSeconds: t + 20 };
}

/** The part of a chapter behind its checkpoint: its last key moments, or the second half. */
export function checkpointRange(chapter: ChapterPublic): TimeRange {
  const length = chapter.endSeconds - chapter.startSeconds;
  const start = length > 240 ? chapter.startSeconds + Math.floor(length / 2) : chapter.startSeconds;
  return { startSeconds: start, endSeconds: chapter.endSeconds };
}

/**
 * Group the student's unresolved weak spots by chapter, worst first. Wrong first attempts at a
 * checkpoint count too, unless a stored checkpoint spot already covers that chapter (stored spots
 * can be resolved; this keeps answers from before weak spots existed visible).
 */
export function weakTopics(
  spots: WeakSpot[],
  chapters: ChapterPublic[],
  attempts: LessonStatusResponse["attempts"],
): WeakTopic[] {
  const byKey = new Map<string, WeakTopic>();
  const chapterTitle = (position: number | null) =>
    position === null ? "Other moments" : (chapters.find((c) => c.position === position)?.title ?? `Chapter ${position + 1}`);

  const topic = (position: number | null): WeakTopic => {
    const key = position === null ? "other" : String(position);
    let t = byKey.get(key);
    if (!t) {
      t = { key, chapterPosition: position, title: chapterTitle(position), score: 0, sources: {}, labels: [], ranges: [], spotIds: [], synthetic: true };
      byKey.set(key, t);
    }
    return t;
  };

  const storedCheckpointChapters = new Set(spots.filter((s) => s.source === "checkpoint").map((s) => s.chapterPosition));

  for (const spot of spots) {
    if (spot.resolvedAt) continue;
    const t = topic(spot.chapterPosition);
    t.synthetic = false;
    t.score += SOURCE_WEIGHT[spot.source];
    t.sources[spot.source] = (t.sources[spot.source] ?? 0) + 1;
    t.ranges.push({ startSeconds: spot.startSeconds, endSeconds: spot.endSeconds });
    t.spotIds.push(spot.id);
    const label = spot.label.trim();
    if (label && label !== t.title && !t.labels.includes(label) && t.labels.length < 4) t.labels.push(label);
  }

  for (const chapter of chapters) {
    const q = chapter.checkpoint;
    if (!q || attempts[q.id]?.isCorrect !== false || storedCheckpointChapters.has(chapter.position)) continue;
    const t = topic(chapter.position);
    t.score += SOURCE_WEIGHT.checkpoint;
    t.sources.checkpoint = (t.sources.checkpoint ?? 0) + 1;
    t.ranges.push(checkpointRange(chapter));
    if (!t.labels.includes(q.concept) && t.labels.length < 4) t.labels.push(q.concept);
  }

  return [...byKey.values()]
    .map((t) => ({ ...t, ranges: mergeRanges(t.ranges) }))
    .sort((a, b) => b.score - a.score || (a.chapterPosition ?? 1e9) - (b.chapterPosition ?? 1e9));
}

/** Every range to rewatch, in lecture order: the "revise weak spots" playlist. */
export function revisionPlaylist(topics: WeakTopic[]): TimeRange[] {
  return mergeRanges(topics.flatMap((t) => t.ranges));
}

export function totalSeconds(ranges: TimeRange[]): number {
  return ranges.reduce((sum, r) => sum + (r.endSeconds - r.startSeconds), 0);
}
