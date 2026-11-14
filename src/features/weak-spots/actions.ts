"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { WeakSpot } from "@/lib/weak-spots/aggregate";
import { listWeakSpots, toWeakSpot, WEAK_SPOT_COLUMNS } from "@/lib/weak-spots/service";
import { YouTubeVideoId } from "@/types/contracts";

const MAX_SPOTS_PER_LECTURE = 300;
/** A second doubt this close to an open one in the same chapter adds nothing new. */
const DOUBT_DEDUP_SECONDS = 45;

const Seconds = z.number().int().min(0).max(24 * 3600);

const AddSchema = z
  .object({
    videoId: YouTubeVideoId,
    chapterPosition: z.number().int().min(0).nullable(),
    label: z.string().trim().min(1).max(200),
    startSeconds: Seconds,
    endSeconds: Seconds,
    // Quiz spots are written by the quiz service, never by the browser.
    source: z.enum(["checkpoint", "doubt", "manual"]),
  })
  .refine((v) => v.endSeconds > v.startSeconds, "The end must be after the start.");

const ResolveSchema = z.object({
  videoId: YouTubeVideoId,
  spotIds: z.array(z.uuid()).max(300),
  /** A wrong checkpoint shown without a stored spot: stored as resolved so it stays hidden. */
  checkpoint: z
    .object({ chapterPosition: z.number().int().min(0), label: z.string().trim().min(1).max(200), startSeconds: Seconds, endSeconds: Seconds })
    .optional(),
});

export type WeakSpotResult = { ok: true; spot: WeakSpot } | { ok: false; message: string };

async function userOrRedirect() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Re-read after the quiz adds or resolves spots on the server. */
export async function getWeakSpots(input: { videoId: string }): Promise<WeakSpot[]> {
  await userOrRedirect();
  const parsed = YouTubeVideoId.safeParse(input.videoId);
  return parsed.success ? listWeakSpots(parsed.data) : [];
}

export async function addWeakSpot(input: z.input<typeof AddSchema>): Promise<WeakSpotResult> {
  const user = await userOrRedirect();
  const parsed = AddSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Couldn't mark that. Try again." };
  const v = parsed.data;
  const supabase = await createClient();

  if (v.source !== "manual") {
    // One open spot per checkpoint chapter; doubts close together collapse into one.
    let query = supabase
      .from("weak_spots")
      .select(WEAK_SPOT_COLUMNS)
      .eq("youtube_video_id", v.videoId)
      .eq("source", v.source)
      .is("resolved_at", null);
    query = v.chapterPosition === null ? query.is("chapter_position", null) : query.eq("chapter_position", v.chapterPosition);
    if (v.source === "doubt") {
      query = query.gte("end_seconds", v.endSeconds - DOUBT_DEDUP_SECONDS).lte("end_seconds", v.endSeconds + DOUBT_DEDUP_SECONDS);
    }
    const { data: existing } = await query.limit(1).maybeSingle();
    if (existing) return { ok: true, spot: toWeakSpot(existing) };
  }

  const { count } = await supabase.from("weak_spots").select("id", { count: "exact", head: true }).eq("youtube_video_id", v.videoId);
  if ((count ?? 0) >= MAX_SPOTS_PER_LECTURE) return { ok: false, message: "This lecture already has 300 weak spots." };

  const { data, error } = await supabase
    .from("weak_spots")
    .insert({
      user_id: user.id,
      youtube_video_id: v.videoId,
      chapter_position: v.chapterPosition,
      label: v.label,
      start_seconds: v.startSeconds,
      end_seconds: v.endSeconds,
      source: v.source,
    })
    .select(WEAK_SPOT_COLUMNS)
    .single();
  if (error || !data) return { ok: false, message: "Couldn't mark that. Try again." };
  return { ok: true, spot: toWeakSpot(data) };
}

/** "Got it now": hide a weak topic. Its spots stay in the database, marked resolved. */
export async function resolveWeakSpots(input: z.input<typeof ResolveSchema>): Promise<{ ok: boolean; spots: WeakSpot[] }> {
  const user = await userOrRedirect();
  const parsed = ResolveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, spots: [] };
  const { videoId, spotIds, checkpoint } = parsed.data;
  const supabase = await createClient();
  const now = new Date().toISOString();
  const spots: WeakSpot[] = [];

  if (spotIds.length > 0) {
    const { data, error } = await supabase
      .from("weak_spots")
      .update({ resolved_at: now })
      .in("id", spotIds)
      .eq("youtube_video_id", videoId)
      .select(WEAK_SPOT_COLUMNS);
    if (error) return { ok: false, spots: [] };
    spots.push(...(data ?? []).map(toWeakSpot));
  }
  if (checkpoint && checkpoint.endSeconds > checkpoint.startSeconds) {
    const { data } = await supabase
      .from("weak_spots")
      .insert({
        user_id: user.id,
        youtube_video_id: videoId,
        chapter_position: checkpoint.chapterPosition,
        label: checkpoint.label,
        start_seconds: checkpoint.startSeconds,
        end_seconds: checkpoint.endSeconds,
        source: "checkpoint",
        resolved_at: now,
      })
      .select(WEAK_SPOT_COLUMNS)
      .single();
    if (data) spots.push(toWeakSpot(data));
  }
  return { ok: true, spots };
}
