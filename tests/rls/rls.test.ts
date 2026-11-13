/**
 * Row Level Security check (Section 7.4). Runs against the LOCAL Supabase stack:
 *
 *   pnpm db:start && pnpm db:reset && pnpm test:rls
 *
 * Signs in two users and one guest (anonymous) and proves that none of them can read or write
 * another's rows, read server-only tables, or execute the service-role-only functions.
 * Reads NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY
 * from the environment or .env.local (values from `pnpm exec supabase status`).
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
  throw new Error(
    "RLS test needs NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY for the local stack (see `pnpm exec supabase status`).",
  );
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url.replace(/\/$/, ""))) {
  throw new Error(`Refusing to run the RLS test against a non-local Supabase URL: ${url}`);
}

type Client = SupabaseClient<Database>;
const FIXTURE_VIDEO = "FIXTURE0001";
const SERVER_ONLY_TABLES = ["lessons", "lesson_chapters", "lesson_jobs", "questions", "ai_calls", "user_api_keys"] as const;

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin: Client = createClient<Database>(url, secretKey, options);

function newClient(): Client {
  return createClient<Database>(url, publishableKey as string, options);
}

type Actor = { name: string; client: Client; id: string };
const actors: { a?: Actor; b?: Actor; guest?: Actor } = {};
const createdUserIds: string[] = [];

async function createPasswordUser(name: string): Promise<Actor> {
  const email = `rls-${name}-${crypto.randomUUID()}@example.test`;
  const password = `pw-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  createdUserIds.push(data.user.id);
  const client = newClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { name, client, id: data.user.id };
}

beforeAll(async () => {
  actors.a = await createPasswordUser("a");
  actors.b = await createPasswordUser("b");

  const guestClient = newClient();
  const guest = await guestClient.auth.signInAnonymously();
  if (guest.error || !guest.data.user) throw guest.error ?? new Error("anonymous sign-in failed (enable it in supabase/config.toml)");
  createdUserIds.push(guest.data.user.id);
  actors.guest = { name: "guest", client: guestClient, id: guest.data.user.id };

  const { error: videoError } = await admin.from("videos").select("youtube_video_id").eq("youtube_video_id", FIXTURE_VIDEO).single();
  if (videoError) throw new Error("Fixture video missing. Run `pnpm db:reset` to apply seed.sql first.");
});

afterAll(async () => {
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
});

function get(key: keyof typeof actors): Actor {
  const actor = actors[key];
  if (!actor) throw new Error(`actor ${key} not set up`);
  return actor;
}

describe("owner data", () => {
  let conceptId = "";
  let conversationId = "";

  beforeAll(async () => {
    const a = get("a");
    const concept = await a.client
      .from("concepts")
      .insert({ user_id: a.id, title: "A's concept", source: "manual", youtube_video_id: FIXTURE_VIDEO })
      .select("id")
      .single();
    expect(concept.error).toBeNull();
    conceptId = concept.data?.id ?? "";

    const item = await a.client
      .from("revision_items")
      .insert({ user_id: a.id, concept_id: conceptId, card: {}, due_at: new Date().toISOString() });
    expect(item.error).toBeNull();

    const conversation = await a.client
      .from("conversations")
      .insert({ user_id: a.id, youtube_video_id: FIXTURE_VIDEO, title: "A's chat" })
      .select("id")
      .single();
    expect(conversation.error).toBeNull();
    conversationId = conversation.data?.id ?? "";

    const message = await a.client
      .from("messages")
      .insert({ conversation_id: conversationId, user_id: a.id, role: "user", parts: [{ type: "text", text: "hi" }] });
    expect(message.error).toBeNull();

    const progress = await a.client
      .from("lesson_progress")
      .insert({ user_id: a.id, youtube_video_id: FIXTURE_VIDEO, output_language: "en", last_position_seconds: 30 });
    expect(progress.error).toBeNull();
  });

  it("owner can read their own rows", async () => {
    const a = get("a");
    expect((await a.client.from("concepts").select("id")).data).toHaveLength(1);
    expect((await a.client.from("revision_items").select("id")).data).toHaveLength(1);
    expect((await a.client.from("messages").select("id")).data).toHaveLength(1);
    expect((await a.client.from("profiles").select("id")).data).toEqual([{ id: a.id }]);
  });

  for (const key of ["b", "guest"] as const) {
    describe(`as ${key}`, () => {
      it("cannot read A's rows", async () => {
        const { client } = get(key);
        for (const table of ["concepts", "revision_items", "conversations", "messages", "lesson_progress"] as const) {
          const { data, error } = await client.from(table).select("*");
          expect(error, table).toBeNull();
          expect(data, table).toEqual([]);
        }
        const profile = await client.from("profiles").select("id").eq("id", get("a").id);
        expect(profile.data).toEqual([]);
      });

      it("cannot write rows as A", async () => {
        const { client } = get(key);
        const a = get("a");
        const insert = await client.from("concepts").insert({ user_id: a.id, title: "spoofed", source: "manual" });
        expect(insert.error).not.toBeNull();

        const update = await client.from("concepts").update({ title: "hacked" }).eq("id", conceptId).select("id");
        expect(update.data ?? []).toEqual([]);

        const del = await client.from("concepts").delete().eq("id", conceptId).select("id");
        expect(del.data ?? []).toEqual([]);

        const still = await admin.from("concepts").select("title").eq("id", conceptId).single();
        expect(still.data?.title).toBe("A's concept");
      });

      it("cannot attach to A's conversation or concept", async () => {
        const actor = get(key);
        const message = await actor.client
          .from("messages")
          .insert({ conversation_id: conversationId, user_id: actor.id, role: "user", parts: [] });
        expect(message.error).not.toBeNull();

        const item = await actor.client
          .from("revision_items")
          .insert({ user_id: actor.id, concept_id: conceptId, card: {}, due_at: new Date().toISOString() });
        expect(item.error).not.toBeNull();
      });

      it("can manage their own rows", async () => {
        const actor = get(key);
        const own = await actor.client
          .from("concepts")
          .insert({ user_id: actor.id, title: `${key}'s concept`, source: "manual" })
          .select("id")
          .single();
        expect(own.error).toBeNull();
        const del = await actor.client.from("concepts").delete().eq("id", own.data?.id ?? "").select("id");
        expect(del.data).toHaveLength(1);
      });

      it("cannot write grading or usage rows", async () => {
        const actor = get(key);
        const question = await admin.from("questions").select("id").limit(1).single();
        expect(question.error).toBeNull();
        const attempt = await actor.client
          .from("question_attempts")
          .insert({ user_id: actor.id, question_id: question.data?.id ?? "", selected_index: 0, is_correct: true });
        expect(attempt.error).not.toBeNull();

        const usage = await actor.client
          .from("usage_daily")
          .insert({ user_id: actor.id, day: new Date().toISOString().slice(0, 10) });
        expect(usage.error).not.toBeNull();
      });
    });
  }
});

describe("server-only tables and functions", () => {
  for (const key of ["a", "b", "guest"] as const) {
    it(`${key} cannot read server-only tables`, async () => {
      const { client } = get(key);
      for (const table of SERVER_ONLY_TABLES) {
        const { data, error } = await client.from(table).select("*").limit(1);
        expect(error !== null || (data ?? []).length === 0, table).toBe(true);
      }
    });

    it(`${key} cannot execute service-role functions`, async () => {
      const actor = get(key);
      const lessonId = "00000000-0000-4000-8000-000000000001";
      const calls = [
        actor.client.rpc("consume_quota", { p_user_id: actor.id, p_kind: "lesson", p_limit: 1000 }),
        actor.client.rpc("global_lessons_today"),
        actor.client.rpc("save_chapter_batch", { p_lesson_id: lessonId, p_details: [] }),
        actor.client.rpc("save_full_lesson", { p_lesson_id: lessonId, p_lesson: {} }),
        actor.client.rpc("mark_chapters_failed", { p_lesson_id: lessonId, p_positions: [0] }),
        actor.client.rpc("refresh_lesson_counters", { p_lesson_id: lessonId }),
      ];
      for (const result of await Promise.all(calls)) {
        expect(result.error).not.toBeNull();
      }
    });

    it(`${key} can read video metadata but not change it`, async () => {
      const { client } = get(key);
      const read = await client.from("videos").select("youtube_video_id").eq("youtube_video_id", FIXTURE_VIDEO);
      expect(read.data).toHaveLength(1);
      const write = await client.from("videos").update({ title: "changed" }).eq("youtube_video_id", FIXTURE_VIDEO).select("title");
      expect(write.error !== null || (write.data ?? []).length === 0).toBe(true);
    });
  }

  it("a request without a session reads nothing", async () => {
    const anon = newClient();
    const videos = await anon.from("videos").select("*");
    expect(videos.error !== null || (videos.data ?? []).length === 0).toBe(true);
    const profiles = await anon.from("profiles").select("*");
    expect(profiles.error !== null || (profiles.data ?? []).length === 0).toBe(true);
  });

  it("consume_quota works for the service role and stops at the limit", async () => {
    const a = get("a");
    const results: (boolean | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const { data, error } = await admin.rpc("consume_quota", { p_user_id: a.id, p_kind: "ai", p_limit: 2 });
      expect(error).toBeNull();
      results.push(data);
    }
    expect(results).toEqual([true, true, false]);
    const usage = await a.client.from("usage_daily").select("ai_requests");
    expect(usage.data).toEqual([{ ai_requests: 2 }]);
  });
});
