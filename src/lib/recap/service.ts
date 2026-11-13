import "server-only";

/**
 * End-of-lesson recap (Section 5.11). No AI call: computed from this student's first attempts
 * and the concepts they saved from this lecture.
 */
import type { OutputLanguage } from "@/config/enums";
import type { CurrentUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getLessonStatus } from "@/lib/lessons/service";
import { toConcept } from "@/lib/revision/service";
import { createClient } from "@/lib/supabase/server";
import type { Recap } from "@/types/contracts";

export async function buildRecap(user: CurrentUser, videoId: string, language: OutputLanguage): Promise<Recap> {
  const status = await getLessonStatus({ user, videoId, language });
  if (!status?.lesson) throw new AppError("not_found", "This lesson doesn't exist yet.");

  const withCheckpoint = status.lesson.chapters.filter((c) => c.checkpoint);
  let answered = 0;
  let correct = 0;
  const worthReviewing: Recap["worthReviewing"] = [];
  for (const c of withCheckpoint) {
    const attempt = c.checkpoint ? status.attempts[c.checkpoint.id] : undefined;
    if (!attempt) continue;
    answered++;
    if (attempt.isCorrect) correct++;
    else worthReviewing.push({ position: c.position, title: c.title, startSeconds: c.startSeconds });
  }

  const supabase = await createClient();
  const { data: concepts } = await supabase
    .from("concepts")
    .select("*, revision_items(due_at)")
    .eq("youtube_video_id", videoId)
    .order("created_at", { ascending: true });
  const now = Date.now();
  const rows = concepts ?? [];
  const conceptsDue = rows.filter((c) => {
    const items = Array.isArray(c.revision_items) ? c.revision_items : c.revision_items ? [c.revision_items] : [];
    return items.some((i) => new Date(i.due_at).getTime() <= now);
  }).length;

  return {
    checkpoints: { answered, correct, total: withCheckpoint.length },
    worthReviewing,
    savedConcepts: rows.map((row) => toConcept(row)),
    conceptsDue,
  };
}
