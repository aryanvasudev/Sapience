/**
 * Study rooms: Row Level Security and the room functions, against the LOCAL Supabase stack
 * (see tests/rls/rls.test.ts for setup). Three users: an owner, a member who joins by code, and
 * an outsider who must never see the room or anyone's progress through it.
 */
import { existsSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!publishableKey || !secretKey) {
  throw new Error("Rooms RLS test needs NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY for the local stack.");
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url.replace(/\/$/, ""))) {
  throw new Error(`Refusing to run the rooms RLS test against a non-local Supabase URL: ${url}`);
}

type Client = SupabaseClient<Database>;
type Actor = { client: Client; id: string };
const FIXTURE_VIDEO = "FIXTURE0001";
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin: Client = createClient<Database>(url, secretKey, options);
const createdUserIds: string[] = [];

async function createUser(name: string): Promise<Actor> {
  const email = `rooms-${name}-${crypto.randomUUID()}@example.test`;
  const password = `pw-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  createdUserIds.push(data.user.id);
  const client = createClient<Database>(url, publishableKey as string, options);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { client, id: data.user.id };
}

let owner: Actor;
let member: Actor;
let outsider: Actor;
let roomId = "";
let code = "";
let goalId = "";

beforeAll(async () => {
  [owner, member, outsider] = await Promise.all([createUser("owner"), createUser("member"), createUser("outsider")]);
  const { error } = await admin.from("videos").select("youtube_video_id").eq("youtube_video_id", FIXTURE_VIDEO).single();
  if (error) throw new Error("Fixture video missing. Run `pnpm db:reset` to apply seed.sql first.");

  const created = await owner.client.rpc("create_room", { p_name: "Mechanics", p_description: "", p_display_name: "Owner" });
  expect(created.error).toBeNull();
  roomId = created.data ?? "";
  const room = await owner.client.from("study_rooms").select("code, description").eq("id", roomId).single();
  expect(room.error).toBeNull();
  expect(room.data?.description).toBeNull();
  code = room.data?.code ?? "";
  expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
});

afterAll(async () => {
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
});

describe("joining", () => {
  it("rejects an unknown code", async () => {
    const { data, error } = await member.client.rpc("join_room", { p_code: "ZZZZZ2", p_display_name: "Member" });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("joins by code, ignoring case and separators", async () => {
    const typed = `${code.slice(0, 3).toLowerCase()}-${code.slice(3)}`;
    const { data, error } = await member.client.rpc("join_room", { p_code: typed, p_display_name: "Member" });
    expect(error).toBeNull();
    expect(data).toBe(roomId);
  });

  it("can't add yourself to a room directly", async () => {
    const { error } = await outsider.client.from("room_members").insert({ room_id: roomId, user_id: outsider.id, display_name: "Sneaky" });
    expect(error).not.toBeNull();
  });
});

describe("visibility", () => {
  beforeAll(async () => {
    const goal = await owner.client
      .from("room_goals")
      .insert({ room_id: roomId, created_by: owner.id, title: "Watch the fixture", youtube_video_id: FIXTURE_VIDEO })
      .select("id")
      .single();
    expect(goal.error).toBeNull();
    goalId = goal.data?.id ?? "";

    for (const [actor, furthest] of [
      [member, 100],
      [outsider, 50],
    ] as const) {
      const { error } = await actor.client.from("lesson_progress").upsert({
        user_id: actor.id,
        youtube_video_id: FIXTURE_VIDEO,
        output_language: "en",
        last_position_seconds: furthest,
        furthest_seconds: furthest,
      });
      expect(error).toBeNull();
    }
  });

  it("members see the room, its members and goals", async () => {
    const [room, members, goals] = await Promise.all([
      member.client.from("study_rooms").select("id").eq("id", roomId),
      member.client.from("room_members").select("user_id").eq("room_id", roomId),
      member.client.from("room_goals").select("id").eq("room_id", roomId),
    ]);
    expect(room.data).toHaveLength(1);
    expect(members.data).toHaveLength(2);
    expect(goals.data).toHaveLength(1);
  });

  it("outsiders see nothing", async () => {
    const [room, members, goals, checks] = await Promise.all([
      outsider.client.from("study_rooms").select("id").eq("id", roomId),
      outsider.client.from("room_members").select("user_id").eq("room_id", roomId),
      outsider.client.from("room_goals").select("id").eq("room_id", roomId),
      outsider.client.from("room_goal_checks").select("goal_id").eq("goal_id", goalId),
    ]);
    expect(room.data).toEqual([]);
    expect(members.data).toEqual([]);
    expect(goals.data).toEqual([]);
    expect(checks.data).toEqual([]);
  });

  it("outsiders can't add goals or tick them", async () => {
    const goal = await outsider.client.from("room_goals").insert({ room_id: roomId, created_by: outsider.id, title: "Spam" });
    expect(goal.error).not.toBeNull();
    const tick = await outsider.client.from("room_goal_checks").insert({ goal_id: goalId, user_id: outsider.id });
    expect(tick.error).not.toBeNull();
  });

  it("members tick goals for themselves only", async () => {
    const mine = await member.client.from("room_goal_checks").insert({ goal_id: goalId, user_id: member.id });
    expect(mine.error).toBeNull();
    const forOwner = await member.client.from("room_goal_checks").insert({ goal_id: goalId, user_id: owner.id });
    expect(forOwner.error).not.toBeNull();
    const seen = await owner.client.from("room_goal_checks").select("user_id").eq("goal_id", goalId);
    expect(seen.data?.map((c) => c.user_id)).toEqual([member.id]);
  });

  it("room_progress shows co-members only, and only to members", async () => {
    const asOwner = await owner.client.rpc("room_progress", { p_room_id: roomId });
    expect(asOwner.error).toBeNull();
    expect(asOwner.data?.map((p) => p.user_id)).toEqual([member.id]);
    expect(asOwner.data?.[0]?.furthest_seconds).toBe(100);

    const asOutsider = await outsider.client.rpc("room_progress", { p_room_id: roomId });
    expect(asOutsider.data ?? []).toEqual([]);
    const activity = await outsider.client.rpc("room_activity", { p_room_id: roomId });
    expect(activity.data ?? []).toEqual([]);
  });

  it("video_peers lists classmates, never strangers", async () => {
    const asOwner = await owner.client.rpc("video_peers", { p_youtube_video_id: FIXTURE_VIDEO });
    expect(asOwner.error).toBeNull();
    expect(asOwner.data?.map((p) => p.user_id)).toEqual([member.id]);
    expect(asOwner.data?.[0]).toMatchObject({ display_name: "Member", room_name: "Mechanics" });

    const asOutsider = await outsider.client.rpc("video_peers", { p_youtube_video_id: FIXTURE_VIDEO });
    expect(asOutsider.data ?? []).toEqual([]);
  });

  it("furthest_seconds never moves backwards", async () => {
    const { error } = await member.client
      .from("lesson_progress")
      .update({ furthest_seconds: 10, last_position_seconds: 10 })
      .eq("user_id", member.id)
      .eq("youtube_video_id", FIXTURE_VIDEO);
    expect(error).toBeNull();
    const { data } = await member.client.from("lesson_progress").select("furthest_seconds, last_position_seconds").eq("youtube_video_id", FIXTURE_VIDEO).single();
    expect(data).toEqual({ furthest_seconds: 100, last_position_seconds: 10 });
  });
});

describe("permissions", () => {
  it("members can't rename, delete, or re-code the room", async () => {
    const rename = await member.client.from("study_rooms").update({ name: "Mine now" }, { count: "exact" }).eq("id", roomId);
    expect(rename.count ?? 0).toBe(0);
    const del = await member.client.from("study_rooms").delete({ count: "exact" }).eq("id", roomId);
    expect(del.count ?? 0).toBe(0);
    const rotate = await member.client.rpc("rotate_room_code", { p_room_id: roomId });
    expect(rotate.error).not.toBeNull();
  });

  it("members can't remove others or promote themselves", async () => {
    const remove = await member.client.from("room_members").delete({ count: "exact" }).eq("room_id", roomId).eq("user_id", owner.id);
    expect(remove.count ?? 0).toBe(0);
    const promote = await member.client.from("room_members").update({ role: "owner" }).eq("room_id", roomId).eq("user_id", member.id);
    expect(promote.error).not.toBeNull();
  });

  it("members rename themselves", async () => {
    const rename = await member.client
      .from("room_members")
      .update({ display_name: "Member Two" }, { count: "exact" })
      .eq("room_id", roomId)
      .eq("user_id", member.id);
    expect(rename.error).toBeNull();
    expect(rename.count).toBe(1);
  });

  it("the owner replaces the code; the old one stops working", async () => {
    const rotated = await owner.client.rpc("rotate_room_code", { p_room_id: roomId });
    expect(rotated.error).toBeNull();
    expect(rotated.data).not.toBe(code);
    const stale = await outsider.client.rpc("join_room", { p_code: code, p_display_name: "Late" });
    expect(stale.data).toBeNull();
  });

  it("the owner can't leave, but removes members and deletes the room", async () => {
    const leave = await owner.client.from("room_members").delete({ count: "exact" }).eq("room_id", roomId).eq("user_id", owner.id);
    expect(leave.count ?? 0).toBe(0);
    const remove = await owner.client.from("room_members").delete({ count: "exact" }).eq("room_id", roomId).eq("user_id", member.id);
    expect(remove.count).toBe(1);
    const del = await owner.client.from("study_rooms").delete({ count: "exact" }).eq("id", roomId);
    expect(del.count).toBe(1);
  });
});
