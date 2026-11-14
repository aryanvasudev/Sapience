import "server-only";

/**
 * Lesson content for server-side generators (quiz, flashcards): the public chapters (no answers)
 * plus the database IDs that generated rows point back to. Secret-key client; callers have
 * already authenticated the student.
 */
import type { OutputLanguage } from "@/config/enums";
import { serverEnv } from "@/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChapterPublic } from "@/types/contracts";

import { serializeLesson } from "./public-serializer";

export type LessonContent = {
  lessonId: string;
  title: string;
  durationSeconds: number;
  chapters: ChapterPublic[];
  /** chapter position → lesson_chapters.id */
  chapterIds: Map<number, string>;
};

export async function loadLessonContent(videoId: string, language: OutputLanguage): Promise<LessonContent | null> {
  const admin = createAdminClient();
  const [{ data: lesson }, { data: video }] = await Promise.all([
    admin
      .from("lessons")
      .select("id, youtube_video_id, output_language, source, status, spoken_language, overview")
      .eq("youtube_video_id", videoId)
      .eq("output_language", language)
      .eq("prompt_version", serverEnv().PROMPT_VERSION)
      .maybeSingle(),
    admin.from("videos").select("title, duration_seconds").eq("youtube_video_id", videoId).maybeSingle(),
  ]);
  if (!lesson || !video) return null;

  const { data: rows } = await admin
    .from("lesson_chapters")
    .select("id, position, status, title, start_seconds, end_seconds, summary, notes_markdown, key_terms, formulas, key_moments, segments")
    .eq("lesson_id", lesson.id)
    .order("position");
  const chapters = rows ?? [];
  return {
    lessonId: lesson.id,
    title: video.title,
    durationSeconds: video.duration_seconds,
    chapters: serializeLesson(lesson, chapters, []).chapters,
    chapterIds: new Map(chapters.map((c) => [c.position, c.id])),
  };
}

/**
 * One chapter as prompt text: title, summary, notes and its lecture index lines (IDs the model may
 * cite). `fence` neutralises delimiter tags inside untrusted text.
 */
export function chapterPromptText(chapter: ChapterPublic, fence: (s: string) => string, maxNotesChars = 6000): string {
  const lines = [
    `Chapter ${chapter.position + 1}: ${fence(chapter.title)}`,
    chapter.summary ? `Summary: ${fence(chapter.summary)}` : "",
    chapter.keyTerms.length ? `Key terms: ${fence(chapter.keyTerms.join("; "))}` : "",
    chapter.formulas.length ? `Formulas: ${fence(chapter.formulas.join("; "))}` : "",
    chapter.notesMarkdown ? `Notes:\n${fence(chapter.notesMarkdown.slice(0, maxNotesChars))}` : "",
    "Lecture index:",
    ...chapter.segments.map(
      (s) => `${s.id} [${s.startSeconds}s-${s.endSeconds}s] said: ${fence(s.speech.slice(0, 600))}${s.board ? ` | board: ${fence(s.board.slice(0, 300))}` : ""}`,
    ),
  ];
  return lines.filter(Boolean).join("\n");
}
