import "server-only";

/**
 * Exam sheet (Section 3.2, P1): one printable page per lesson with the notes, formulas and key
 * terms of every ready chapter, the concepts the student saved from this lecture, and the
 * checkpoints they got wrong on the first try with the right answer. No AI call.
 *
 * Answers and explanations are included only for questions this student has already attempted,
 * the same rule as grading (Section 5.7).
 */
import type { OutputLanguage } from "@/config/enums";
import type { CurrentUser } from "@/lib/auth";
import { getLessonStatus } from "@/lib/lessons/service";
import { listNotes, type PersonalNote } from "@/lib/notes/service";
import { toConcept } from "@/lib/revision/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ChapterPublic, Concept, LessonPublic, VideoPublic } from "@/types/contracts";

export type MissedQuestion = {
  chapterPosition: number;
  chapterTitle: string;
  startSeconds: number;
  prompt: string;
  options: string[];
  selectedIndex: number;
  correctIndex: number;
  explanation: string;
  misconception: string | null;
};

export type ExamSheet = {
  video: VideoPublic;
  lesson: Pick<LessonPublic, "source" | "overview" | "status" | "language">;
  chapters: ChapterPublic[];
  chaptersTotal: number;
  savedConcepts: Concept[];
  missed: MissedQuestion[];
  notes: PersonalNote[];
};

export async function buildExamSheet(user: CurrentUser, videoId: string, language: OutputLanguage): Promise<ExamSheet | null> {
  const status = await getLessonStatus({ user, videoId, language });
  if (!status?.lesson) return null;
  const { lesson } = status;

  const chapters = lesson.chapters.filter((c) => c.status === "ready");
  const checkpointChapters = new Map(chapters.flatMap((c) => (c.checkpoint ? [[c.checkpoint.id, c] as const] : [])));
  const supabase = await createClient();

  const [concepts, attempts, notes] = await Promise.all([
    supabase.from("concepts").select("*").eq("youtube_video_id", videoId).order("created_at", { ascending: true }),
    checkpointChapters.size
      ? supabase
          .from("question_attempts")
          .select("question_id, selected_index, is_correct, created_at")
          .in("question_id", [...checkpointChapters.keys()])
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    listNotes(videoId),
  ]);

  // First attempt per question; only wrong ones go on the sheet.
  const first = new Map<string, { selectedIndex: number; isCorrect: boolean }>();
  for (const a of attempts.data ?? []) {
    if (!first.has(a.question_id)) first.set(a.question_id, { selectedIndex: a.selected_index, isCorrect: a.is_correct });
  }
  const wrongIds = [...first].filter(([, a]) => !a.isCorrect).map(([id]) => id);

  const missed: MissedQuestion[] = [];
  if (wrongIds.length) {
    const { data: questions } = await createAdminClient()
      .from("questions")
      .select("id, prompt, options, correct_index, explanation, misconception")
      .in("id", wrongIds);
    for (const q of questions ?? []) {
      const chapter = checkpointChapters.get(q.id);
      const attempt = first.get(q.id);
      if (!chapter || !attempt || !Array.isArray(q.options)) continue;
      missed.push({
        chapterPosition: chapter.position,
        chapterTitle: chapter.title,
        startSeconds: chapter.startSeconds,
        prompt: q.prompt,
        options: q.options.filter((o): o is string => typeof o === "string"),
        selectedIndex: attempt.selectedIndex,
        correctIndex: q.correct_index,
        explanation: q.explanation,
        misconception: q.misconception,
      });
    }
    missed.sort((a, b) => a.chapterPosition - b.chapterPosition);
  }

  return {
    video: status.video,
    lesson: { source: lesson.source, overview: lesson.overview, status: lesson.status, language: lesson.language },
    chapters,
    chaptersTotal: lesson.chapters.length,
    savedConcepts: (concepts.data ?? []).map((row) => toConcept(row)),
    missed,
    notes,
  };
}
