/**
 * Bring your own key (Section 4.5.4) against the LOCAL stack: `user_api_keys` is unreadable to
 * students, create_lesson records whose key to use, and chapter jobs inherit it only while the
 * outline job that creates them is running.
 */
import { existsSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!secretKey || !publishableKey) throw new Error("BYOK test needs the local stack keys.");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url.replace(/\/$/, ""))) {
  throw new Error(`Refusing to run the BYOK test against a non-local Supabase URL: ${url}`);
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin: SupabaseClient<Database> = createClient<Database>(url, secretKey, options);
const VIDEO_ID = `bk${crypto.randomUUID().replace(/-/g, "").slice(0, 9)}`;
const password = `pw-${crypto.randomUUID()}`;
let userId = "";
let student: SupabaseClient<Database>;

beforeAll(async () => {
  const email = `byok-${crypto.randomUUID()}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("createUser failed");
  userId = created.data.user.id;
  student = createClient<Database>(url, publishableKey, options);
  const signIn = await student.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  const video = await admin.from("videos").insert({ youtube_video_id: VIDEO_ID, title: "BYOK test video", duration_seconds: 1200 });
  if (video.error) throw video.error;
});

afterAll(async () => {
  await admin.from("lessons").delete().eq("youtube_video_id", VIDEO_ID);
  await admin.from("videos").delete().eq("youtube_video_id", VIDEO_ID);
  if (userId) await admin.auth.admin.deleteUser(userId);
});

describe("bring your own key", () => {
  it("keeps user_api_keys away from students, even their own row", async () => {
    const insert = await admin
      .from("user_api_keys")
      .insert({ user_id: userId, provider: "gemini", ciphertext: String.raw`\x00`, iv: String.raw`\x00`, last4: "abcd" });
    expect(insert.error).toBeNull();
    const read = await student.from("user_api_keys").select("*");
    expect(read.data ?? []).toHaveLength(0);
    const write = await student.from("user_api_keys").update({ last4: "zzzz" }).eq("user_id", userId).select();
    expect(write.data ?? []).toHaveLength(0);
    await admin.from("user_api_keys").delete().eq("user_id", userId);
  });

  it("records the key owner on the first job, and chapter jobs inherit it only during the outline", async () => {
    const { data, error } = await admin.rpc("create_lesson", {
      p_youtube_video_id: VIDEO_ID,
      p_output_language: "en",
      p_prompt_version: `byok-${crypto.randomUUID().slice(0, 8)}`,
      p_source: "gemini_video",
      p_created_by: userId,
      p_job_kind: "outline",
      p_job_payload: {},
      p_byok_user_id: userId,
    });
    expect(error).toBeNull();
    const { lesson_id: lessonId, job_id: jobId } = data![0];
    const first = await admin.from("lesson_jobs").select("byok_user_id").eq("id", jobId!).single();
    expect(first.data?.byok_user_id).toBe(userId);

    // While the outline job runs, new chapter jobs inherit the owner.
    await admin.from("lesson_jobs").update({ status: "running" }).eq("id", jobId!);
    const during = await admin.from("lesson_jobs").insert({ lesson_id: lessonId, kind: "chapters", payload: {} }).select("byok_user_id").single();
    expect(during.data?.byok_user_id).toBe(userId);

    // Afterwards (e.g. a chapter retry by someone else), they don't.
    await admin.from("lesson_jobs").update({ status: "done" }).eq("id", jobId!);
    const later = await admin.from("lesson_jobs").insert({ lesson_id: lessonId, kind: "chapters", payload: {} }).select("byok_user_id").single();
    expect(later.data?.byok_user_id).toBeNull();
  });
});
