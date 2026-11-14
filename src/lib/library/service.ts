import "server-only";

/**
 * Library and featured lessons (Sections 5.12, 6.1). The student's own rows go through the
 * user-scoped client (RLS); lessons are a shared, server-only table, so their status is read with
 * the secret key and only `ready` ones are returned.
 */
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";

import { FEATURED_LESSONS } from "@/config/featured";
import { OUTPUT_LANGUAGES, type OutputLanguage } from "@/config/enums";
import { serverEnv } from "@/env";
import { formatDue } from "@/lib/format";
import { toConcept } from "@/lib/revision/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Concept } from "@/types/contracts";

export type LessonCard = {
  videoId: string;
  language: OutputLanguage;
  title: string;
  channel: string | null;
  durationSeconds: number;
  thumbnailUrl: string | null;
};

export type FeaturedLesson = LessonCard & { fixture: boolean };
export type OpenedLesson = LessonCard & { positionSeconds: number; updatedAt: string };
export type SavedConcept = Concept & { dueAt: string | null; dueLabel: string; videoTitle: string | null };

const toLanguage = (value: string): OutputLanguage =>
  (OUTPUT_LANGUAGES as readonly string[]).includes(value) ? (value as OutputLanguage) : "en";

/**
 * Ready featured lessons, in config order. Hand-written fixture lessons (seeded only into local
 * databases by `supabase/seed.sql`) are listed after them and flagged, so they are always
 * labelled as test data and never presented as AI output.
 */
export async function listFeatured(): Promise<FeaturedLesson[]> {
  try {
    return await loadFeatured();
  } catch {
    return [];
  }
}

/**
 * The same for every student, so it is cached across requests instead of costing two queries on
 * every visit to Home. A failed read throws, and a thrown error is never cached.
 */
async function loadFeatured(): Promise<FeaturedLesson[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("featured-lessons");
  const admin = createAdminClient();
  const version = serverEnv().PROMPT_VERSION;
  const ids = FEATURED_LESSONS.map((f) => f.videoId);

  const [featured, fixtures] = await Promise.all([
    ids.length
      ? admin
          .from("lessons")
          .select("youtube_video_id, output_language, source, videos(title, channel_title, duration_seconds, thumbnail_url)")
          .in("youtube_video_id", ids)
          .eq("prompt_version", version)
          .eq("status", "ready")
      : Promise.resolve({ data: [], error: null }),
    admin
      .from("lessons")
      .select("youtube_video_id, output_language, source, videos(title, channel_title, duration_seconds, thumbnail_url)")
      .eq("source", "fixture")
      .eq("prompt_version", version)
      .eq("status", "ready")
      .limit(3),
  ]);
  if (featured.error || fixtures.error) throw new Error("featured lessons unavailable");

  const rows = [
    ...FEATURED_LESSONS.flatMap((f) =>
      (featured.data ?? []).filter((r) => r.youtube_video_id === f.videoId && r.output_language === f.language),
    ),
    ...(fixtures.data ?? []),
  ];
  return rows.flatMap((r) =>
    r.videos
      ? [
          {
            videoId: r.youtube_video_id,
            language: toLanguage(r.output_language),
            title: r.videos.title,
            channel: r.videos.channel_title,
            durationSeconds: r.videos.duration_seconds,
            thumbnailUrl: r.videos.thumbnail_url,
            fixture: r.source === "fixture",
          },
        ]
      : [],
  );
}

/** Every lecture the student has opened, most recent first. Shared by every caller in a request. */
export const listOpenedLessons = cache(async (): Promise<OpenedLesson[] | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lesson_progress")
    .select(
      "youtube_video_id, output_language, last_position_seconds, updated_at, videos(title, channel_title, duration_seconds, thumbnail_url)",
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return null;
  return data.flatMap((row) =>
    row.videos
      ? [
          {
            videoId: row.youtube_video_id,
            language: toLanguage(row.output_language),
            positionSeconds: row.last_position_seconds,
            updatedAt: row.updated_at,
            title: row.videos.title,
            channel: row.videos.channel_title,
            durationSeconds: row.videos.duration_seconds,
            thumbnailUrl: row.videos.thumbnail_url,
          },
        ]
      : [],
  );
});

/** Saved concepts with their next review and the lecture they came from. */
export async function listSavedConcepts(): Promise<SavedConcept[] | null> {
  const supabase = await createClient();
  // Concepts come from lectures the student opened, so those titles usually cover every concept
  // and the lookup below only runs for the rest, instead of always waiting on a second query.
  const [{ data, error }, opened] = await Promise.all([
    supabase.from("concepts").select("*, revision_items(due_at)").order("created_at", { ascending: false }).limit(500),
    listOpenedLessons(),
  ]);
  if (error) return null;

  const titles = new Map((opened ?? []).map((lesson) => [lesson.videoId, lesson.title]));
  const missing = [...new Set(data.flatMap((row) => (row.youtube_video_id && !titles.has(row.youtube_video_id) ? [row.youtube_video_id] : [])))];
  if (missing.length) {
    const { data: videos } = await supabase.from("videos").select("youtube_video_id, title").in("youtube_video_id", missing);
    for (const v of videos ?? []) titles.set(v.youtube_video_id, v.title);
  }

  const now = Date.now();
  return data.map((row) => {
    const { revision_items: items, ...concept } = row;
    const item = Array.isArray(items) ? items[0] : items;
    return {
      ...toConcept(concept),
      dueAt: item?.due_at ?? null,
      dueLabel: formatDue(item?.due_at ?? null, now),
      videoTitle: row.youtube_video_id ? (titles.get(row.youtube_video_id) ?? null) : null,
    };
  });
}
