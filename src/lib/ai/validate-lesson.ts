/**
 * Code-level validation of model output, after the Zod schema check (Section 5.3). Pure, unit
 * tested. Small, deterministic problems are fixed here (snapping, clamping, dropping bad LaTeX);
 * anything that needs the model to try again is returned as a list of problems, which the caller
 * appends to the prompt for one repair retry.
 */
import katex from "katex";

import type { ChapterDetail, Checkpoint, Outline } from "./schemas/lesson";
import { fixEscapedNewlines } from "@/lib/lessons/public-serializer";

export type Validated<T> = { ok: true; value: T } | { ok: false; problems: string[] };

/** Gaps or overlaps up to this size between neighbouring chapters are snapped shut. */
export const SNAP_TOLERANCE_SECONDS = 5;
const FIRST_CHAPTER_MAX_START = 30;
const MIN_CHAPTER_SECONDS = 60;
const SHORT_VIDEO_SECONDS = 180;
const MIN_SEGMENT_SECONDS = 15;
const MAX_SEGMENT_SECONDS = 120;
const SEGMENT_OVERSHOOT_TOLERANCE = 10;
const MIN_SEGMENT_COVERAGE = 0.8;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * `mergeShort: false` reports short chapters as problems instead of merging them. Used for the
 * single-pass lesson, where each chapter carries its own details and can't be merged in code.
 */
export function validateOutline<O extends Outline>(
  outline: O,
  durationSeconds: number,
  opts: { mergeShort?: boolean } = {},
): Validated<O> {
  const problems: string[] = [];
  const chapters: O["chapters"] = outline.chapters
    .map((c) => ({ ...c, title: c.title.trim() }))
    .sort((a, b) => a.startSeconds - b.startSeconds);

  // Bounds.
  for (const c of chapters) {
    if (c.startSeconds >= durationSeconds) {
      problems.push(`Chapter "${c.title}" starts at ${mmss(c.startSeconds)}, after the video ends (${mmss(durationSeconds)}).`);
    }
    c.endSeconds = Math.min(c.endSeconds, durationSeconds);
    if (c.endSeconds <= c.startSeconds && c.startSeconds < durationSeconds) {
      problems.push(`Chapter "${c.title}" ends before it starts.`);
    }
  }
  if (problems.length > 0) return { ok: false, problems };

  // First chapter starts at the beginning.
  if (chapters[0].startSeconds > FIRST_CHAPTER_MAX_START) {
    problems.push(`The first chapter must start at 0:00 (it starts at ${mmss(chapters[0].startSeconds)}).`);
  } else {
    chapters[0].startSeconds = 0;
  }

  // Contiguous: snap small gaps/overlaps, report big ones.
  for (let i = 1; i < chapters.length; i++) {
    const prev = chapters[i - 1];
    const cur = chapters[i];
    const gap = cur.startSeconds - prev.endSeconds;
    if (Math.abs(gap) <= SNAP_TOLERANCE_SECONDS) {
      cur.startSeconds = prev.endSeconds;
    } else if (gap > 0) {
      problems.push(`There is a gap from ${mmss(prev.endSeconds)} to ${mmss(cur.startSeconds)} between chapters.`);
    } else {
      problems.push(`Chapters "${prev.title}" and "${cur.title}" overlap (${mmss(cur.startSeconds)}–${mmss(prev.endSeconds)}).`);
    }
  }

  // The last chapter runs to the end of the video.
  const last = chapters[chapters.length - 1];
  const tail = durationSeconds - last.endSeconds;
  if (tail > Math.max(30, durationSeconds * 0.05)) {
    problems.push(`Chapters stop at ${mmss(last.endSeconds)} but the video is ${mmss(durationSeconds)} long.`);
  } else {
    last.endSeconds = durationSeconds;
  }
  if (problems.length > 0) return { ok: false, problems };

  // Minimum length: merge very short chapters into a neighbour (deterministic, no retry needed).
  const minLength = durationSeconds < SHORT_VIDEO_SECONDS ? 1 : MIN_CHAPTER_SECONDS;
  if (opts.mergeShort === false) {
    for (const c of chapters) {
      if (c.endSeconds - c.startSeconds < minLength) {
        problems.push(`Chapter "${c.title}" is shorter than ${minLength} seconds; merge it with a neighbouring chapter.`);
      }
    }
    if (problems.length > 0) return { ok: false, problems };
    return { ok: true, value: { ...outline, overview: outline.overview.trim(), chapters } };
  }
  const merged: O["chapters"] = [];
  for (const c of chapters) {
    const prev = merged[merged.length - 1];
    if (prev && prev.endSeconds - prev.startSeconds < minLength) {
      prev.endSeconds = c.endSeconds; // previous was too short: absorb this one into it
      continue;
    }
    if (prev && c.endSeconds - c.startSeconds < minLength) {
      prev.endSeconds = c.endSeconds;
      continue;
    }
    merged.push({ ...c });
  }

  return { ok: true, value: { ...outline, overview: outline.overview.trim(), chapters: merged } };
}

/** Length of the union of intervals, so overlapping segments aren't counted twice. */
export function coveredSeconds(intervals: { startSeconds: number; endSeconds: number }[]): number {
  let total = 0;
  let reach = -Infinity;
  for (const i of [...intervals].sort((a, b) => a.startSeconds - b.startSeconds)) {
    const from = Math.max(i.startSeconds, reach);
    if (i.endSeconds > from) total += i.endSeconds - from;
    reach = Math.max(reach, i.endSeconds);
  }
  return total;
}

export type ChapterBounds = { startSeconds: number; endSeconds: number };

/** True if `latex` renders with KaTeX. Formulas that don't are dropped rather than failing the chapter. */
export function isValidLatex(latex: string): boolean {
  try {
    katex.renderToString(latex, { throwOnError: true, displayMode: true, strict: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function validateCheckpoint(checkpoint: Checkpoint | null, problems: string[]): Checkpoint | null {
  if (!checkpoint) return null;
  const options = checkpoint.options.map((o) => o.trim());
  if (options.length !== 4) {
    problems.push(`The checkpoint question "${checkpoint.question.slice(0, 60)}" must have exactly 4 options.`);
  }
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
    problems.push(`The checkpoint question "${checkpoint.question.slice(0, 60)}" has duplicate options.`);
  }
  return { ...checkpoint, options };
}

/**
 * Validate one chapter's details against its fixed boundaries.
 * `segmentsFromCode` skips segment checks (transcript lessons build segments deterministically).
 */
export function validateChapterDetail<D extends Omit<ChapterDetail, "segments"> & { segments?: ChapterDetail["segments"] }>(
  detail: D,
  bounds: ChapterBounds,
  opts: { segmentsFromCode?: boolean } = {},
): Validated<D> {
  const problems: string[] = [];
  const { startSeconds: start, endSeconds: end } = bounds;
  const label = `Chapter ${detail.position + 1} (${mmss(start)}–${mmss(end)})`;

  // Key moments: clamp near-misses into the chapter, drop the rest, max 10.
  const keyMoments = detail.keyMoments
    .filter((m) => m.seconds >= start - SNAP_TOLERANCE_SECONDS && m.seconds <= end + SNAP_TOLERANCE_SECONDS)
    .map((m) => ({ seconds: Math.min(Math.max(m.seconds, start), end), label: m.label.trim() }))
    .sort((a, b) => a.seconds - b.seconds)
    .slice(0, 10);

  const formulas = detail.formulas
    .map((f) => f.trim())
    .filter((f) => f.length > 0 && isValidLatex(f))
    .slice(0, 10);
  const keyTerms = [...new Set(detail.keyTerms.map((t) => t.trim()).filter(Boolean))].slice(0, 15);
  const checkpoint = validateCheckpoint(detail.checkpoint, problems);

  let segments = detail.segments;
  if (!opts.segmentsFromCode && segments) {
    const sorted = [...segments]
      .map((s) => ({
        ...s,
        startSeconds: Math.max(s.startSeconds, start),
        endSeconds: Math.min(s.endSeconds, end),
        speech: s.speech.trim(),
        board: s.board?.trim() ? s.board.trim() : null,
      }))
      .filter((s) => s.endSeconds > s.startSeconds)
      .sort((a, b) => a.startSeconds - b.startSeconds);

    // Merge segments shorter than the minimum into the previous one (keeps every word).
    const merged: typeof sorted = [];
    for (const s of sorted) {
      const prev = merged[merged.length - 1];
      if (prev && s.endSeconds - s.startSeconds < MIN_SEGMENT_SECONDS && s.endSeconds - prev.startSeconds <= MAX_SEGMENT_SECONDS) {
        prev.endSeconds = Math.max(prev.endSeconds, s.endSeconds);
        prev.speech = `${prev.speech} ${s.speech}`.slice(0, 1500);
        prev.board = [prev.board, s.board].filter(Boolean).join("\n").slice(0, 600) || null;
      } else {
        merged.push({ ...s });
      }
    }
    // A short first segment has no previous one to join: fold it into the next.
    if (merged.length > 1 && merged[0].endSeconds - merged[0].startSeconds < MIN_SEGMENT_SECONDS) {
      const [first, next] = merged;
      if (next.endSeconds - first.startSeconds <= MAX_SEGMENT_SECONDS) {
        next.startSeconds = first.startSeconds;
        next.speech = `${first.speech} ${next.speech}`.slice(0, 1500);
        next.board = [first.board, next.board].filter(Boolean).join("\n").slice(0, 600) || null;
        merged.shift();
      }
    }
    for (const s of merged) {
      if (s.endSeconds - s.startSeconds < MIN_SEGMENT_SECONDS && merged.length > 1) {
        problems.push(`${label}: the lecture-index segment ${mmss(s.startSeconds)}–${mmss(s.endSeconds)} is shorter than ${MIN_SEGMENT_SECONDS} seconds; join it to a neighbour.`);
      }
    }

    for (const s of merged) {
      if (s.endSeconds - s.startSeconds > MAX_SEGMENT_SECONDS + SEGMENT_OVERSHOOT_TOLERANCE) {
        problems.push(`${label}: the lecture-index segment ${mmss(s.startSeconds)}–${mmss(s.endSeconds)} is longer than ${MAX_SEGMENT_SECONDS} seconds; split it.`);
      }
    }
    const covered = coveredSeconds(merged);
    if (merged.length === 0 || covered / (end - start) < MIN_SEGMENT_COVERAGE) {
      problems.push(`${label}: the lecture-index segments cover only ${Math.round((covered / (end - start)) * 100)}% of the chapter; cover at least ${MIN_SEGMENT_COVERAGE * 100}%.`);
    }
    segments = merged;
  }

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    value: {
      ...detail,
      summary: detail.summary.trim(),
      notesMarkdown: fixEscapedNewlines(detail.notesMarkdown.trim()),
      keyTerms,
      formulas,
      keyMoments,
      checkpoint,
      ...(segments ? { segments } : {}),
    },
  };
}
