/**
 * Tutor context packet (Section 5.6.2). Pure builder, unit tested; the loader lives in
 * `src/lib/tutor/service.ts`.
 *
 * Decides what the tutor sees for a question at time `t`: preferences, lesson notes, the
 * lecture-index window, optional video clip, pasted text and recent messages. Also returns the
 * context sources shown as chips above the answer. Every piece of lecture or student text is
 * wrapped in labelled delimiters as data.
 */
import type { TutorClipMode, TutorQuickAction } from "@/config/enums";
import { formatTimestamp } from "@/lib/format";
import type { ContextSource, Preferences } from "@/types/contracts";

export const INDEX_BEFORE_SECONDS = 180;
export const INDEX_AFTER_SECONDS = 30;

export type PacketSegment = { startSeconds: number; endSeconds: number; speech: string; board: string | null };
export type PacketChapter = {
  position: number;
  title: string;
  startSeconds: number;
  endSeconds: number;
  status: string;
  summary: string | null;
  notesMarkdown: string | null;
  keyTerms: string[];
  formulas: string[];
  segments: PacketSegment[];
};

export type PacketLesson = {
  overview: string | null;
  source: string;
  chapters: PacketChapter[];
};

export type PacketInput = {
  t: number;
  durationSeconds: number;
  lesson: PacketLesson | null;
  preferences: Preferences;
  tutorClipCapable: boolean;
  clipMode: TutorClipMode;
  clipBeforeSeconds: number;
  clipAfterSeconds: number;
  quickAction?: TutorQuickAction;
  chapterPosition?: number;
  pastedText?: string;
};

export type ContextPacket = {
  /** Clip to send with the question, or null. */
  clip: { startSeconds: number; endSeconds: number } | null;
  /** Text blocks placed after the video part, before the question. */
  contextText: string;
  /** Sources when the clip is used. */
  sourcesWithClip: ContextSource[];
  /** Sources if the clip fails or isn't used. */
  sourcesWithoutClip: ContextSource[];
  /** True when there is lecture material (index or notes) to answer from without the clip. */
  hasLectureText: boolean;
};

const PACKET_TAGS =
  /<\s*(\/?)\s*(student_preferences|playback_position|lecture_overview|chapter_outline|chapter_notes|lecture_index|transcript|student_pasted_text|question|chapter|overview)\b/gi;

/**
 * Neutralise our own delimiter tags inside untrusted text (lecture text, notes, pasted text, the
 * question), so data can never close its block and pose as instructions.
 */
export function fence(text: string): string {
  return text.replace(PACKET_TAGS, "‹$1$2");
}

const range = (a: number, b: number) => `${formatTimestamp(a)}-${formatTimestamp(b)}`;

export function clipWindow(t: number, duration: number, before: number, after: number) {
  const start = Math.max(0, Math.floor(t - before));
  const end = Math.min(Math.floor(duration), Math.ceil(t + after));
  return { startSeconds: start, endSeconds: Math.max(end, Math.min(start + 1, Math.floor(duration))) };
}

/** Segments overlapping [t − 180, t + 30]. */
export function indexWindow(chapters: PacketChapter[], t: number): PacketSegment[] {
  const from = t - INDEX_BEFORE_SECONDS;
  const to = t + INDEX_AFTER_SECONDS;
  return chapters
    .filter((c) => c.status === "ready")
    .flatMap((c) => c.segments)
    .filter((s) => s.endSeconds > from && s.startSeconds < to)
    .sort((a, b) => a.startSeconds - b.startSeconds);
}

export function chapterAtTime(chapters: PacketChapter[], t: number): PacketChapter | null {
  return chapters.find((c) => t >= c.startSeconds && t < c.endSeconds) ?? chapters[chapters.length - 1] ?? null;
}

export function buildContextPacket(input: PacketInput): ContextPacket {
  const chapters = input.lesson?.chapters ?? [];
  const current =
    (input.chapterPosition !== undefined ? chapters.find((c) => c.position === input.chapterPosition) : undefined) ??
    chapterAtTime(chapters, input.t);
  const fromTranscript = input.lesson?.source === "transcript_paste";
  const segments = indexWindow(chapters, input.t);
  const notesReady = current?.status === "ready";

  // Clip only when the provider can, and (always) or (on_demand and (board asked, or index missing here)).
  const wantsClip =
    input.tutorClipCapable &&
    (input.clipMode === "always" || input.quickAction === "board" || segments.length === 0);
  const clip = wantsClip ? clipWindow(input.t, input.durationSeconds, input.clipBeforeSeconds, input.clipAfterSeconds) : null;

  const blocks: string[] = [];
  const p = input.preferences;
  blocks.push(
    `<student_preferences>level: ${p.level}; maths detail: ${p.mathDetail}; tone: ${p.tone}</student_preferences>`,
    `<playback_position>The student is at ${formatTimestamp(input.t)} of a ${formatTimestamp(input.durationSeconds)} lecture.</playback_position>`,
  );

  if (input.lesson?.overview) blocks.push(`<lecture_overview>${fence(input.lesson.overview)}</lecture_overview>`);
  if (chapters.length > 0) {
    blocks.push(
      `<chapter_outline>\n${chapters.map((c) => `${c.position + 1}. [${formatTimestamp(c.startSeconds)}] ${fence(c.title)}`).join("\n")}\n</chapter_outline>`,
    );
  }
  if (current && notesReady) {
    const parts = [`Chapter ${current.position + 1}: ${fence(current.title)} (${range(current.startSeconds, current.endSeconds)})`];
    if (current.summary) parts.push(`Summary: ${fence(current.summary)}`);
    if (current.keyTerms.length) parts.push(`Key terms: ${fence(current.keyTerms.join(", "))}`);
    if (current.formulas.length) parts.push(`Formulas (LaTeX): ${fence(current.formulas.join(" ; "))}`);
    if (current.notesMarkdown) parts.push(`Notes:\n${fence(current.notesMarkdown)}`);
    blocks.push(`<chapter_notes>\n${parts.join("\n")}\n</chapter_notes>`);
  }
  if (segments.length > 0) {
    const tag = fromTranscript ? "transcript" : "lecture_index";
    blocks.push(
      `<${tag}>\n${segments
        .map((s) => `[${formatTimestamp(s.startSeconds)}-${formatTimestamp(s.endSeconds)}] said: ${fence(s.speech)}${s.board ? `\n  board: ${fence(s.board)}` : ""}`)
        .join("\n")}\n</${tag}>`,
    );
  }
  if (input.pastedText?.trim()) {
    blocks.push(`<student_pasted_text>\n${fence(input.pastedText.trim())}\n</student_pasted_text>`);
  }

  const textSources: ContextSource[] = [];
  if (segments.length > 0) {
    const first = segments[0].startSeconds;
    const last = segments[segments.length - 1].endSeconds;
    textSources.push(`${fromTranscript ? "transcript" : "lecture_index"}:${range(first, last)}` as ContextSource);
  }
  if (current && notesReady) textSources.push(`chapter_notes:${current.position + 1}` as ContextSource);

  const hasLectureText = textSources.length > 0;
  return {
    clip,
    contextText: blocks.join("\n\n"),
    sourcesWithClip: clip ? [`video_clip:${range(clip.startSeconds, clip.endSeconds)}` as ContextSource, ...textSources] : textSources,
    sourcesWithoutClip: hasLectureText ? textSources : ["general_knowledge"],
    hasLectureText,
  };
}
