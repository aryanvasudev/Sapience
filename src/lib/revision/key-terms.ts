import "server-only";

/**
 * "Add all key terms to revision" (Section 3.2, P1). Each key term of a ready chapter becomes a
 * concept (source `key_term`) that points back to its chapter. Its answer side is the chapter's
 * summary, which the lesson already shows, so nothing is revealed early.
 */
import type { CurrentUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getLessonStatus } from "@/lib/lessons/service";
import { createClient } from "@/lib/supabase/server";
import type { KeyTermsRequest, KeyTermsResponse } from "@/types/contracts";

import { saveConcept } from "./service";

/** Upper bound per request, so one lecture can't flood the revision queue. */
export const MAX_KEY_TERMS = 40;

const normalize = (term: string) => term.replace(/\s+/g, " ").trim();

export async function saveKeyTerms(user: CurrentUser, input: KeyTermsRequest): Promise<KeyTermsResponse> {
  const status = await getLessonStatus({ user, videoId: input.youtubeVideoId, language: input.language });
  if (!status?.lesson) throw new AppError("not_found", "This lesson doesn't exist yet.");

  const seen = new Set<string>();
  const terms: { title: string; chapterPosition: number; chapterTitle: string; startSeconds: number; summary: string | null }[] = [];
  for (const c of status.lesson.chapters) {
    if (c.status !== "ready") continue;
    for (const raw of c.keyTerms) {
      const title = normalize(raw);
      const key = title.toLowerCase();
      if (title.length < 2 || title.length > 200 || seen.has(key)) continue;
      seen.add(key);
      terms.push({ title, chapterPosition: c.position, chapterTitle: c.title, startSeconds: c.startSeconds, summary: c.summary });
    }
  }
  const wanted = terms.slice(0, MAX_KEY_TERMS);

  const supabase = await createClient();
  const { data: existing } = await supabase.from("concepts").select("title").eq("youtube_video_id", input.youtubeVideoId);
  const saved = new Set((existing ?? []).map((c) => c.title.toLowerCase()));

  let added = 0;
  let alreadySaved = 0;
  for (const t of wanted) {
    if (saved.has(t.title.toLowerCase())) {
      alreadySaved++;
      continue;
    }
    const where = `From chapter ${t.chapterPosition + 1}, *${t.chapterTitle}*.`;
    await saveConcept(user, {
      youtubeVideoId: input.youtubeVideoId,
      language: input.language,
      sourceSeconds: t.startSeconds,
      title: t.title,
      explanationMarkdown: t.summary ? `${where}\n\n${t.summary}` : where,
      source: "key_term",
    });
    added++;
  }
  return { added, alreadySaved };
}
