import "server-only";

/** Weak spots (see ./aggregate.ts). Reads use the student's own client, so RLS applies. */
import { WEAK_SPOT_SOURCES, type WeakSpotSource } from "@/config/enums";
import { createClient } from "@/lib/supabase/server";

import type { WeakSpot } from "./aggregate";

export type WeakSpotRow = {
  id: string;
  chapter_position: number | null;
  label: string;
  start_seconds: number;
  end_seconds: number;
  source: string;
  resolved_at: string | null;
  created_at: string;
};

export const WEAK_SPOT_COLUMNS = "id, chapter_position, label, start_seconds, end_seconds, source, resolved_at, created_at";

export const toWeakSpot = (row: WeakSpotRow): WeakSpot => ({
  id: row.id,
  chapterPosition: row.chapter_position,
  label: row.label,
  startSeconds: row.start_seconds,
  endSeconds: row.end_seconds,
  source: (WEAK_SPOT_SOURCES as readonly string[]).includes(row.source) ? (row.source as WeakSpotSource) : "manual",
  resolvedAt: row.resolved_at,
  createdAt: row.created_at,
});

/** The student's weak spots for one lecture, resolved ones included (the UI hides them). */
export async function listWeakSpots(videoId: string): Promise<WeakSpot[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weak_spots")
    .select(WEAK_SPOT_COLUMNS)
    .eq("youtube_video_id", videoId)
    .order("start_seconds")
    .limit(500);
  return (data ?? []).map(toWeakSpot);
}
