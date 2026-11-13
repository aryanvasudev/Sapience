/**
 * Group transcript lines into lecture-index segments of 30–90 s (Section 5.8). Deterministic, no
 * AI. Segments are contiguous: each ends where the next begins, the last ends at the video's
 * duration. `board` is always null (a transcript has no board).
 */
import type { TranscriptLine } from "./parse";

export type TranscriptSegment = { startSeconds: number; endSeconds: number; speech: string; board: null };

const TARGET_SECONDS = 60;
const MIN_SECONDS = 30;
const MAX_SECONDS = 90;
const MAX_SPEECH_CHARS = 1400;

export function segmentTranscript(lines: TranscriptLine[], durationSeconds: number): TranscriptSegment[] {
  const usable = lines.filter((l) => l.seconds < durationSeconds && l.text.length > 0);
  const groups: { start: number; texts: string[]; chars: number }[] = [];

  for (const line of usable) {
    const group = groups[groups.length - 1];
    const elapsed = group ? line.seconds - group.start : 0;
    const wouldOverflow = group ? group.chars + line.text.length + 1 > MAX_SPEECH_CHARS : false;
    const startNew =
      !group ||
      elapsed >= MAX_SECONDS ||
      (elapsed >= TARGET_SECONDS && /[.?!।]$/.test(group.texts[group.texts.length - 1] ?? "")) ||
      (elapsed >= MIN_SECONDS && wouldOverflow) ||
      elapsed >= TARGET_SECONDS + 15;
    // The first segment starts at 0 unless speech begins late (then a silent intro would make it too long).
    if (startNew) groups.push({ start: groups.length === 0 && line.seconds <= MIN_SECONDS ? 0 : line.seconds, texts: [line.text], chars: line.text.length });
    else {
      group.texts.push(line.text);
      group.chars += line.text.length + 1;
    }
  }

  // A short last group joins the previous one when that stays within the maximum.
  if (groups.length > 1) {
    const last = groups[groups.length - 1];
    const prev = groups[groups.length - 2];
    if (durationSeconds - last.start < MIN_SECONDS && durationSeconds - prev.start <= MAX_SECONDS + 15) {
      prev.texts.push(...last.texts);
      prev.chars += last.chars + 1;
      groups.pop();
    }
  }

  const segments = groups.map((g, i) => ({
    startSeconds: g.start,
    endSeconds: i + 1 < groups.length ? groups[i + 1].start : durationSeconds,
    speech: truncate(g.texts.join(" "), 1500),
    board: null,
  }));
  return segments.filter((s) => s.endSeconds > s.startSeconds);
}

function truncate(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Segments whose start falls inside [start, end). */
export function segmentsInRange<T extends { startSeconds: number }>(segments: T[], start: number, end: number): T[] {
  return segments.filter((s) => s.startSeconds >= start && s.startSeconds < end);
}

/**
 * Move chapter boundaries onto segment starts so every segment sits inside exactly one chapter.
 * Each boundary snaps to the nearest segment start; chapters that collapse are dropped.
 */
export function alignChaptersToSegments<C extends { startSeconds: number; endSeconds: number }>(
  chapters: C[],
  segments: TranscriptSegment[],
  durationSeconds: number,
): C[] {
  if (segments.length === 0) return chapters;
  const starts = segments.map((s) => s.startSeconds);
  const nearest = (t: number) => starts.reduce((best, s) => (Math.abs(s - t) < Math.abs(best - t) ? s : best), starts[0]);

  const aligned = chapters.map((c, i) => ({ ...c, startSeconds: i === 0 ? 0 : nearest(c.startSeconds) }));
  const result: C[] = [];
  for (let i = 0; i < aligned.length; i++) {
    const end = i + 1 < aligned.length ? aligned[i + 1].startSeconds : durationSeconds;
    if (end > aligned[i].startSeconds) result.push({ ...aligned[i], endSeconds: end });
  }
  // Re-stitch after dropping collapsed chapters.
  for (let i = 0; i < result.length; i++) {
    result[i].endSeconds = i + 1 < result.length ? result[i + 1].startSeconds : durationSeconds;
  }
  return result;
}
