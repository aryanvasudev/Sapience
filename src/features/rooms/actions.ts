"use server";

/**
 * Study rooms (create, join by code, goals, membership). Every action re-reads the user and uses
 * the user-scoped client, so RLS and the room functions decide what's allowed; the checks here
 * only turn a refusal into a clear message.
 */
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { isRoomCode, normalizeRoomCode } from "@/lib/rooms/code";
import { listVideoPeers, MAX_DISPLAY_NAME, type VideoPeer } from "@/lib/rooms/service";
import { createClient } from "@/lib/supabase/server";
import { getCachedVideo, getEligibleVideo } from "@/lib/youtube/videos";
import { isVideoId, parseYouTubeUrl } from "@/lib/youtube/parse-url";
import { YouTubeVideoId } from "@/types/contracts";

export type RoomActionResult = { ok: true } | { ok: false; message: string };
export type RoomIdResult = { ok: true; roomId: string } | { ok: false; message: string };

const MAX_GOALS_PER_ROOM = 100;

const DisplayName = z
  .string()
  .trim()
  .min(1, "Add the name your classmates will see.")
  .max(MAX_DISPLAY_NAME, `Keep your name under ${MAX_DISPLAY_NAME} characters.`);
const RoomId = z.uuid();

async function userOrRedirect(next = "/app/rooms") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

const firstIssue = (error: z.ZodError, fallback: string) => error.issues[0]?.message ?? fallback;

const CreateRoomSchema = z.object({
  name: z.string().trim().min(1, "Give the room a name.").max(60, "Keep the name under 60 characters."),
  description: z.string().trim().max(280, "Keep the description under 280 characters.").optional(),
  displayName: DisplayName,
});

export async function createRoom(input: z.input<typeof CreateRoomSchema>): Promise<RoomIdResult> {
  await userOrRedirect();
  const parsed = CreateRoomSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error, "Check the room details.") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_room", {
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? "",
    p_display_name: parsed.data.displayName,
  });
  if (error?.hint === "room_limit") return { ok: false, message: "You can own up to 20 rooms. Delete one you no longer use first." };
  if (error || !data) return { ok: false, message: "Couldn't create the room. Try again." };
  return { ok: true, roomId: data };
}

const JoinSchema = z.object({ code: z.string().max(32), displayName: DisplayName });

export async function joinRoom(input: z.input<typeof JoinSchema>): Promise<RoomIdResult> {
  await userOrRedirect("/app/rooms/join");
  const parsed = JoinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error, "Check the code.") };
  const code = normalizeRoomCode(parsed.data.code);
  if (!isRoomCode(code)) return { ok: false, message: "Room codes are 6 letters and numbers, like K7Q 4MX." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_room", { p_code: code, p_display_name: parsed.data.displayName });
  if (error?.hint === "room_full") return { ok: false, message: "That room is full (50 people)." };
  if (error) return { ok: false, message: "Couldn't join the room. Try again." };
  if (!data) return { ok: false, message: "No room has that code. Check it with whoever shared it; it may have been replaced." };
  return { ok: true, roomId: data };
}

export async function leaveRoom(input: { roomId: string }): Promise<RoomActionResult> {
  const user = await userOrRedirect();
  const roomId = RoomId.safeParse(input.roomId);
  if (!roomId.success) return { ok: false, message: "That room doesn't exist." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("room_members")
    .delete({ count: "exact" })
    .eq("room_id", roomId.data)
    .eq("user_id", user.id);
  if (error || !count) return { ok: false, message: "Couldn't leave the room. If you own it, delete it instead." };
  return { ok: true };
}

export async function removeMember(input: { roomId: string; userId: string }): Promise<RoomActionResult> {
  await userOrRedirect();
  const parsed = z.object({ roomId: RoomId, userId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "That member isn't in this room." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("room_members")
    .delete({ count: "exact" })
    .eq("room_id", parsed.data.roomId)
    .eq("user_id", parsed.data.userId);
  if (error || !count) return { ok: false, message: "Only the room's owner can remove people." };
  refresh();
  return { ok: true };
}

export async function deleteRoom(input: { roomId: string }): Promise<RoomActionResult> {
  await userOrRedirect();
  const roomId = RoomId.safeParse(input.roomId);
  if (!roomId.success) return { ok: false, message: "That room doesn't exist." };
  const supabase = await createClient();
  const { error, count } = await supabase.from("study_rooms").delete({ count: "exact" }).eq("id", roomId.data);
  if (error || !count) return { ok: false, message: "Only the room's owner can delete it." };
  return { ok: true };
}

export async function rotateCode(input: { roomId: string }): Promise<{ ok: true; code: string } | { ok: false; message: string }> {
  await userOrRedirect();
  const roomId = RoomId.safeParse(input.roomId);
  if (!roomId.success) return { ok: false, message: "That room doesn't exist." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rotate_room_code", { p_room_id: roomId.data });
  if (error || !data) return { ok: false, message: "Only the room's owner can replace the code." };
  refresh();
  return { ok: true, code: data };
}

export async function renameMe(input: { roomId: string; displayName: string }): Promise<RoomActionResult> {
  const user = await userOrRedirect();
  const parsed = z.object({ roomId: RoomId, displayName: DisplayName }).safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error, "Check your name.") };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("room_members")
    .update({ display_name: parsed.data.displayName }, { count: "exact" })
    .eq("room_id", parsed.data.roomId)
    .eq("user_id", user.id);
  if (error || !count) return { ok: false, message: "Couldn't change your name. Try again." };
  refresh();
  return { ok: true };
}

const AddGoalSchema = z.object({
  roomId: RoomId,
  title: z.string().trim().max(120, "Keep the goal under 120 characters.").optional(),
  /** A YouTube link, or the ID of a lecture picked from the student's library. */
  video: z.string().trim().max(2048).optional(),
  dueAt: z.iso.datetime({ offset: true }).optional(),
});

export async function addGoal(input: z.input<typeof AddGoalSchema>): Promise<RoomActionResult> {
  const user = await userOrRedirect();
  const parsed = AddGoalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error, "Check the goal.") };
  const { roomId, dueAt } = parsed.data;

  let videoId: string | null = null;
  let videoTitle: string | null = null;
  if (parsed.data.video) {
    videoId = isVideoId(parsed.data.video) ? parsed.data.video : (parseYouTubeUrl(parsed.data.video)?.videoId ?? null);
    if (!videoId) return { ok: false, message: "That doesn't look like a YouTube video link." };
    // The title and duration must be cached, so everyone's progress bar has something to measure.
    videoTitle = (await getCachedVideo(videoId))?.title ?? null;
    if (!videoTitle) {
      try {
        videoTitle = (await getEligibleVideo(videoId)).title;
      } catch (error) {
        // Too long to build a lesson from is still fine as a goal; it was cached before the check.
        const cached = error instanceof AppError && error.code === "video_duration" ? await getCachedVideo(videoId) : null;
        if (!cached) return { ok: false, message: error instanceof AppError ? error.message : "Couldn't check that video. Try again." };
        videoTitle = cached.title;
      }
    }
  }
  const title = parsed.data.title || (videoTitle ? `Watch “${videoTitle}”` : "");
  if (!title) return { ok: false, message: "Describe the goal, or pick a lecture." };

  const supabase = await createClient();
  const { count } = await supabase.from("room_goals").select("id", { count: "exact", head: true }).eq("room_id", roomId);
  if ((count ?? 0) >= MAX_GOALS_PER_ROOM) return { ok: false, message: "This room has 100 goals. Delete finished ones first." };

  const { error } = await supabase.from("room_goals").insert({
    room_id: roomId,
    created_by: user.id,
    title: title.slice(0, 120),
    youtube_video_id: videoId,
    due_at: dueAt ?? null,
  });
  if (error) return { ok: false, message: "Couldn't add the goal. Try again." };
  refresh();
  return { ok: true };
}

export async function deleteGoal(input: { goalId: string }): Promise<RoomActionResult> {
  await userOrRedirect();
  const goalId = z.uuid().safeParse(input.goalId);
  if (!goalId.success) return { ok: false, message: "That goal doesn't exist." };
  const supabase = await createClient();
  const { error, count } = await supabase.from("room_goals").delete({ count: "exact" }).eq("id", goalId.data);
  if (error || !count) return { ok: false, message: "Only whoever added a goal, or the room's owner, can delete it." };
  refresh();
  return { ok: true };
}

export async function toggleGoalCheck(input: { goalId: string; done: boolean }): Promise<RoomActionResult> {
  const user = await userOrRedirect();
  const parsed = z.object({ goalId: z.uuid(), done: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "That goal doesn't exist." };
  const supabase = await createClient();
  const { error } = parsed.data.done
    ? await supabase.from("room_goal_checks").upsert({ goal_id: parsed.data.goalId, user_id: user.id }, { onConflict: "goal_id,user_id", ignoreDuplicates: true })
    : await supabase.from("room_goal_checks").delete().eq("goal_id", parsed.data.goalId).eq("user_id", user.id);
  if (error) return { ok: false, message: "Couldn't update the goal. Try again." };
  refresh();
  return { ok: true };
}

/** Polled by the lesson screen's classmates strip. Never throws; no session → no peers. */
export async function getVideoPeers(input: { videoId: string }): Promise<VideoPeer[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const videoId = YouTubeVideoId.safeParse(input.videoId);
  if (!videoId.success) return [];
  return listVideoPeers(videoId.data);
}
