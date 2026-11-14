import "server-only";

/**
 * Study rooms. Everything goes through the user-scoped client, so RLS decides what a student
 * sees: only rooms they belong to, and classmates' progress only through the security-definer
 * functions `room_progress`, `room_activity` and `video_peers` (which check membership).
 */
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { lectureDone } from "./progress";

export const MAX_DISPLAY_NAME = 40;

export type RoomSummary = {
  id: string;
  name: string;
  description: string | null;
  isOwner: boolean;
  memberCount: number;
  goalCount: number;
  goalsDoneByMe: number;
  nextDue: { title: string; dueAt: string } | null;
};

export type RoomMember = {
  userId: string;
  displayName: string;
  role: "owner" | "member";
  joinedAt: string;
  isMe: boolean;
  /** What they last played, and when (any lecture). */
  lastActivity: { videoId: string; videoTitle: string | null; updatedAt: string } | null;
};

export type MemberProgress = { furthestSeconds: number; lastPositionSeconds: number; updatedAt: string };

export type RoomGoal = {
  id: string;
  title: string;
  createdBy: string | null;
  createdAt: string;
  dueAt: string | null;
  video: { id: string; title: string | null; durationSeconds: number | null } | null;
  checks: { userId: string; doneAt: string }[];
  /** Lecture goals: each member's progress on that lecture, by user ID. */
  progress: Record<string, MemberProgress>;
  canDelete: boolean;
};

export type RoomDetail = {
  id: string;
  name: string;
  description: string | null;
  code: string;
  isOwner: boolean;
  me: string;
  createdAt: string;
  /** When this snapshot was read (ms), for "studying now" and "5 min ago". */
  now: number;
  members: RoomMember[];
  goals: RoomGoal[];
};

export type VideoPeer = {
  userId: string;
  displayName: string;
  roomId: string;
  roomName: string;
  furthestSeconds: number;
  lastPositionSeconds: number;
  updatedAt: string;
};

/** The name a student shows in a new room: their profile name, their email's local part, or "Guest". */
export async function defaultDisplayName(user: CurrentUser): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const fromProfile = data?.display_name?.trim();
  if (fromProfile) return fromProfile.slice(0, MAX_DISPLAY_NAME);
  const local = user.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (local) return local.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, MAX_DISPLAY_NAME);
  return "Guest";
}

/** Rooms the student belongs to, newest first. */
export async function listMyRooms(user: CurrentUser): Promise<RoomSummary[] | null> {
  const supabase = await createClient();
  // The student's own progress (with each lecture's length) is read alongside the rooms rather
  // than after them, to count the lecture goals they've finished without a second round trip.
  const [{ data, error }, { data: progress }] = await Promise.all([
    supabase
      .from("study_rooms")
      .select("id, name, description, owner_id, created_at, room_members(count), room_goals(id, title, due_at, youtube_video_id, room_goal_checks(user_id))")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("lesson_progress").select("youtube_video_id, furthest_seconds, videos(duration_seconds)").limit(1000),
  ]);
  if (error) return null;

  const finished = new Set<string>();
  for (const p of progress ?? []) {
    if (lectureDone(p.furthest_seconds, p.videos?.duration_seconds)) finished.add(p.youtube_video_id);
  }

  const now = Date.now();
  return data.map((room) => {
    const upcoming = room.room_goals
      .filter((g) => g.due_at && new Date(g.due_at).getTime() >= now - 86_400_000)
      .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""))[0];
    return {
      id: room.id,
      name: room.name,
      description: room.description,
      isOwner: room.owner_id === user.id,
      memberCount: room.room_members[0]?.count ?? 0,
      goalCount: room.room_goals.length,
      goalsDoneByMe: room.room_goals.filter(
        (g) => g.room_goal_checks.some((c) => c.user_id === user.id) || (g.youtube_video_id !== null && finished.has(g.youtube_video_id)),
      ).length,
      nextDue: upcoming?.due_at ? { title: upcoming.title, dueAt: upcoming.due_at } : null,
    };
  });
}

/** One room with its members, goals and progress, or null if it doesn't exist or isn't yours. */
export async function getRoom(user: CurrentUser, roomId: string): Promise<RoomDetail | null> {
  const supabase = await createClient();
  // Everything starts at once: the other reads are scoped to members by RLS and the RPCs, so for
  // a room that doesn't exist or isn't yours they come back empty and the result is discarded.
  const [{ data: room }, members, goals, progress, activity] = await Promise.all([
    supabase.from("study_rooms").select("id, name, description, code, owner_id, created_at").eq("id", roomId).maybeSingle(),
    supabase.from("room_members").select("user_id, display_name, role, joined_at").eq("room_id", roomId).order("joined_at"),
    supabase
      .from("room_goals")
      .select("id, title, created_by, created_at, due_at, youtube_video_id, room_goal_checks(user_id, done_at)")
      .eq("room_id", roomId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase.rpc("room_progress", { p_room_id: roomId }),
    supabase.rpc("room_activity", { p_room_id: roomId }),
  ]);
  if (!room) return null;

  const goalRows = goals.data ?? [];
  const videoIds = [...new Set(goalRows.map((g) => g.youtube_video_id).filter((v): v is string => v !== null))];
  const { data: videos } = videoIds.length
    ? await supabase.from("videos").select("youtube_video_id, title, duration_seconds").in("youtube_video_id", videoIds)
    : { data: [] };
  const videoById = new Map((videos ?? []).map((v) => [v.youtube_video_id, v]));

  const progressByVideo = new Map<string, Record<string, MemberProgress>>();
  for (const p of progress.data ?? []) {
    const forVideo = progressByVideo.get(p.youtube_video_id) ?? {};
    forVideo[p.user_id] = { furthestSeconds: p.furthest_seconds, lastPositionSeconds: p.last_position_seconds, updatedAt: p.updated_at };
    progressByVideo.set(p.youtube_video_id, forVideo);
  }
  const activityByUser = new Map((activity.data ?? []).map((a) => [a.user_id, a]));
  const isOwner = room.owner_id === user.id;

  return {
    id: room.id,
    name: room.name,
    description: room.description,
    code: room.code,
    isOwner,
    me: user.id,
    createdAt: room.created_at,
    now: Date.now(),
    members: (members.data ?? []).map((m) => {
      const last = activityByUser.get(m.user_id);
      return {
        userId: m.user_id,
        displayName: m.display_name,
        role: m.role === "owner" ? "owner" : "member",
        joinedAt: m.joined_at,
        isMe: m.user_id === user.id,
        lastActivity: last ? { videoId: last.youtube_video_id, videoTitle: last.video_title, updatedAt: last.updated_at } : null,
      };
    }),
    goals: goalRows.map((g) => {
      const video = g.youtube_video_id ? videoById.get(g.youtube_video_id) : undefined;
      return {
        id: g.id,
        title: g.title,
        createdBy: g.created_by,
        createdAt: g.created_at,
        dueAt: g.due_at,
        video: g.youtube_video_id
          ? { id: g.youtube_video_id, title: video?.title ?? null, durationSeconds: video?.duration_seconds ?? null }
          : null,
        checks: g.room_goal_checks.map((c) => ({ userId: c.user_id, doneAt: c.done_at })),
        progress: (g.youtube_video_id && progressByVideo.get(g.youtube_video_id)) || {},
        canDelete: isOwner || g.created_by === user.id,
      };
    }),
  };
}

/** Classmates (from every room the student is in) who have opened this lecture. */
export async function listVideoPeers(videoId: string): Promise<VideoPeer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("video_peers", { p_youtube_video_id: videoId });
  if (error || !data) return [];
  return data.map((p) => ({
    userId: p.user_id,
    displayName: p.display_name,
    roomId: p.room_id,
    roomName: p.room_name,
    furthestSeconds: p.furthest_seconds,
    lastPositionSeconds: p.last_position_seconds,
    updatedAt: p.updated_at,
  }));
}
