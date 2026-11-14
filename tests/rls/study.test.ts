/**
 * Weak spots, the study calendar, quizzes, flashcards and watched progress: Row Level Security
 * against the LOCAL Supabase stack (see tests/rls/rls.test.ts for setup).
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
  throw new Error("Study RLS test needs NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY for the local stack.");
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url.replace(/\/$/, ""))) {
  throw new Error(`Refusing to run the study RLS test against a non-local Supabase URL: ${url}`);
}

type Client = SupabaseClient<Database>;
type Actor = { client: Client; id: string };
const FIXTURE_VIDEO = "FIXTURE0001";
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin: Client = createClient<Database>(url, secretKey, options);
const createdUserIds: string[] = [];

async function createUser(name: string): Promise<Actor> {
  const email = `study-${name}-${crypto.randomUUID()}@example.test`;
  const password = `pw-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  createdUserIds.push(data.user.id);
  const client = createClient<Database>(url, publishableKey as string, options);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { client, id: data.user.id };
}

let alice: Actor;
let bob: Actor;

beforeAll(async () => {
  [alice, bob] = await Promise.all([createUser("alice"), createUser("bob")]);
  const { error } = await admin.from("videos").select("youtube_video_id").eq("youtube_video_id", FIXTURE_VIDEO).single();
  if (error) throw new Error("Fixture video missing. Run `pnpm db:reset` to apply seed.sql first.");
});

afterAll(async () => {
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
});

describe("weak spots", () => {
  it("owners add, read and resolve their own; others see nothing", async () => {
    const added = await alice.client
      .from("weak_spots")
      .insert({ user_id: alice.id, youtube_video_id: FIXTURE_VIDEO, chapter_position: 0, label: "Limits", start_seconds: 10, end_seconds: 40, source: "doubt" })
      .select("id")
      .single();
    expect(added.error).toBeNull();
    const id = added.data?.id ?? "";

    const theirs = await bob.client.from("weak_spots").select("id").eq("id", id);
    expect(theirs.data).toEqual([]);
    const update = await bob.client.from("weak_spots").update({ resolved_at: new Date().toISOString() }).eq("id", id).select("id");
    expect(update.data).toEqual([]);

    const resolved = await alice.client.from("weak_spots").update({ resolved_at: new Date().toISOString() }).eq("id", id).select("resolved_at").single();
    expect(resolved.data?.resolved_at).not.toBeNull();
  });

  it("can't be written for someone else or with an unknown source", async () => {
    const forBob = await alice.client
      .from("weak_spots")
      .insert({ user_id: bob.id, youtube_video_id: FIXTURE_VIDEO, label: "x", start_seconds: 0, end_seconds: 5, source: "manual" });
    expect(forBob.error).not.toBeNull();
    const badSource = await alice.client
      .from("weak_spots")
      .insert({ user_id: alice.id, youtube_video_id: FIXTURE_VIDEO, label: "x", start_seconds: 0, end_seconds: 5, source: "teacher" });
    expect(badSource.error).not.toBeNull();
  });
});

describe("study calendar", () => {
  it("events and feed tokens are private to their owner", async () => {
    const start = new Date(Date.now() + 3600_000);
    const event = await alice.client
      .from("study_events")
      .insert({ user_id: alice.id, title: "Finish mechanics", starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 1800_000).toISOString() })
      .select("id")
      .single();
    expect(event.error).toBeNull();
    expect((await bob.client.from("study_events").select("id").eq("id", event.data?.id ?? "")).data).toEqual([]);

    const token = "t".repeat(40);
    expect((await alice.client.from("calendar_feeds").insert({ user_id: alice.id, token })).error).toBeNull();
    expect((await bob.client.from("calendar_feeds").select("token").eq("user_id", alice.id)).data).toEqual([]);
  });
});

describe("server-only tables", () => {
  it("students can't read or write quiz sessions or flashcard decks", async () => {
    const sessions = await alice.client.from("quiz_sessions").select("id");
    expect(sessions.error).not.toBeNull();
    const insert = await alice.client
      .from("quiz_sessions")
      .insert({ user_id: alice.id, youtube_video_id: FIXTURE_VIDEO, output_language: "en", scope: "lesson" });
    expect(insert.error).not.toBeNull();
    const decks = await alice.client.from("lesson_flashcards").select("lesson_id");
    expect(decks.error).not.toBeNull();
  });
});

describe("watched progress", () => {
  it("furthest_seconds never goes backwards", async () => {
    const row = { user_id: alice.id, youtube_video_id: FIXTURE_VIDEO, output_language: "en" };
    expect((await alice.client.from("lesson_progress").upsert({ ...row, last_position_seconds: 300, furthest_seconds: 300 }, { onConflict: "user_id,youtube_video_id" })).error).toBeNull();
    await alice.client.from("lesson_progress").upsert({ ...row, last_position_seconds: 20, furthest_seconds: 20 }, { onConflict: "user_id,youtube_video_id" });
    const saved = await alice.client.from("lesson_progress").select("furthest_seconds, last_position_seconds").eq("youtube_video_id", FIXTURE_VIDEO).single();
    expect(saved.data).toEqual({ furthest_seconds: 300, last_position_seconds: 20 });
  });
});
