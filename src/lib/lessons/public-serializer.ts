/**
 * The only way lesson content leaves the server (Section 5.4, 12.1). Pure.
 *
 * Builds `LessonPublic` from database rows with an explicit allow-list of fields. A checkpoint's
 * `correct_index`, `explanation` and `misconception` are never read here, so they can't leak
 * into the payload even if a caller passes full rows.
 */
import { CHAPTER_STATUSES, LESSON_SOURCES, LESSON_STATUSES, OUTPUT_LANGUAGES } from "@/config/enums";
import type { ChapterPublic, KeyMoment, LessonPublic, QuestionPublic, Segment } from "@/types/contracts";

/**
 * Some models return notes with the two characters `\n` instead of line breaks, which Markdown
 * shows as a stray "n". Only notes with no real line break are touched, and `\n` before a
 * lowercase letter stays, so LaTeX such as `\nabla` or `\neq` survives. Pure.
 */
export function fixEscapedNewlines(markdown: string): string {
  if (markdown.includes("\n") || !markdown.includes("\\n")) return markdown;
  return markdown.replace(/\\r\\n|\\n(?![a-z])/g, "\n").replace(/\\t/g, "  ");
}

export type LessonRow = {
  youtube_video_id: string;
  output_language: string;
  source: string;
  status: string;
  spoken_language: string | null;
  overview: string | null;
};

export type ChapterRow = {
  id: string;
  position: number;
  status: string;
  title: string;
  start_seconds: number;
  end_seconds: number;
  summary: string | null;
  notes_markdown: string | null;
  key_terms: string[];
  formulas: string[];
  key_moments: unknown;
  segments: unknown;
};

/** Question columns that are safe before an attempt. Anything else on the row is ignored. */
export type QuestionRow = {
  id: string;
  chapter_id: string | null;
  concept: string;
  prompt: string;
  options: unknown;
  at_seconds: number | null;
};

const pick = <T extends string>(allowed: readonly T[], value: string, fallback: T): T =>
  (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

function keyMoments(value: unknown): KeyMoment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((m): KeyMoment[] => {
    if (typeof m !== "object" || m === null) return [];
    const { id, seconds, label } = m as Record<string, unknown>;
    if (typeof id !== "string" || typeof seconds !== "number" || typeof label !== "string") return [];
    return [{ id, seconds: Math.max(0, Math.round(seconds)), label }];
  });
}

function segments(value: unknown): Segment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((s): Segment[] => {
    if (typeof s !== "object" || s === null) return [];
    const { id, startSeconds, endSeconds, speech, board } = s as Record<string, unknown>;
    if (typeof id !== "string" || typeof startSeconds !== "number" || typeof endSeconds !== "number" || typeof speech !== "string") {
      return [];
    }
    return [{ id, startSeconds, endSeconds, speech, board: typeof board === "string" ? board : null }];
  });
}

export function toQuestionPublic(q: QuestionRow): QuestionPublic | null {
  const options = Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === "string") : [];
  if (options.length !== 4) return null;
  return { id: q.id, concept: q.concept, prompt: q.prompt, options, atSeconds: q.at_seconds };
}

export function serializeLesson(lesson: LessonRow, chapters: ChapterRow[], questions: QuestionRow[]): LessonPublic {
  const byChapter = new Map<string, QuestionPublic>();
  for (const q of questions) {
    const pub = q.chapter_id ? toQuestionPublic(q) : null;
    if (q.chapter_id && pub) byChapter.set(q.chapter_id, pub);
  }

  const publicChapters: ChapterPublic[] = [...chapters]
    .sort((a, b) => a.position - b.position)
    .map((c) => {
      const ready = c.status === "ready";
      return {
        position: c.position,
        status: pick(CHAPTER_STATUSES, c.status, "pending"),
        title: c.title,
        startSeconds: c.start_seconds,
        endSeconds: c.end_seconds,
        summary: ready ? c.summary : null,
        notesMarkdown: ready && c.notes_markdown ? fixEscapedNewlines(c.notes_markdown) : null,
        keyTerms: ready ? c.key_terms : [],
        formulas: ready ? c.formulas : [],
        keyMoments: ready ? keyMoments(c.key_moments) : [],
        segments: ready ? segments(c.segments) : [],
        checkpoint: ready ? (byChapter.get(c.id) ?? null) : null,
      };
    });

  return {
    youtubeVideoId: lesson.youtube_video_id,
    language: pick(OUTPUT_LANGUAGES, lesson.output_language, "en"),
    source: pick(LESSON_SOURCES, lesson.source, "gemini_video"),
    status: pick(LESSON_STATUSES, lesson.status, "queued"),
    spokenLanguage: lesson.spoken_language,
    overview: lesson.overview,
    chapters: publicChapters,
  };
}
