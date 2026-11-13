/**
 * Lesson job system (Section 5.4) against the LOCAL Supabase stack:
 *
 *   pnpm db:start && pnpm db:reset && pnpm test:rls
 *
 * Exercises the service-role functions in 20261113000004_jobs.sql and 20261113000003_functions.sql
 * through the secret-key client: create_lesson, claim_lesson_job, requeue_lesson_job,
 * fail_lesson_job, save_outline, save_chapter_batch, retry_chapters and dispatchable_jobs.
 * Uses its own `videos` row (a random 11-character ID) and deletes everything it created.
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from the environment or .env.local.
 */
import { existsSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database, Json } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!secretKey) {
  throw new Error("Jobs test needs SUPABASE_SECRET_KEY for the local stack (see `pnpm exec supabase status`).");
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url.replace(/\/$/, ""))) {
  throw new Error(`Refusing to run the jobs test against a non-local Supabase URL: ${url}`);
}

type JobRow = Database["public"]["Tables"]["lesson_jobs"]["Row"];
type JobInsert = Database["public"]["Tables"]["lesson_jobs"]["Insert"];

const admin: SupabaseClient<Database> = createClient<Database>(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const VIDEO_ID = `jt${crypto.randomUUID().replace(/-/g, "").slice(0, 9)}`;
const BIG_CAP = 1000;
let userId = "";
let versionCounter = 0;

const secondsFromNow = (s: number) => new Date(Date.now() + s * 1000).toISOString();
const msUntil = (iso: string | null) => (iso === null ? Number.NaN : new Date(iso).getTime() - Date.now());

beforeAll(async () => {
  expect(VIDEO_ID).toMatch(/^[A-Za-z0-9_-]{11}$/);
  const user = await admin.auth.admin.createUser({ email: `jobs-${crypto.randomUUID()}@example.test`, email_confirm: true });
  if (user.error || !user.data.user) throw user.error ?? new Error("createUser failed");
  userId = user.data.user.id;

  const video = await admin.from("videos").insert({ youtube_video_id: VIDEO_ID, title: "Jobs test video", duration_seconds: 1800 });
  if (video.error) throw video.error;
});

afterAll(async () => {
  // lesson_chapters, lesson_jobs and questions cascade from lessons.
  await admin.from("lessons").delete().eq("youtube_video_id", VIDEO_ID);
  await admin.from("videos").delete().eq("youtube_video_id", VIDEO_ID);
  if (userId) await admin.auth.admin.deleteUser(userId);
});

async function createLesson(kind = "outline"): Promise<{ lessonId: string; jobId: string; version: string }> {
  const version = `jobs-test-${++versionCounter}`;
  const { data, error } = await admin.rpc("create_lesson", {
    p_youtube_video_id: VIDEO_ID,
    p_output_language: "en",
    p_prompt_version: version,
    p_source: "gemini_video",
    p_created_by: userId,
    p_job_kind: kind,
    p_job_payload: {},
  });
  expect(error).toBeNull();
  const row = data?.[0];
  if (!row?.created || !row.job_id) throw new Error("create_lesson did not create a lesson");
  return { lessonId: row.lesson_id, jobId: row.job_id, version };
}

async function insertJob(lessonId: string, fields: Partial<JobInsert> = {}): Promise<JobRow> {
  const { data, error } = await admin
    .from("lesson_jobs")
    .insert({ lesson_id: lessonId, kind: "chapters", payload: { positions: [0] }, ...fields })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("insert job failed");
  return data;
}

async function getJob(id: string): Promise<JobRow> {
  const { data, error } = await admin.from("lesson_jobs").select("*").eq("id", id).single();
  if (error || !data) throw error ?? new Error("job not found");
  return data;
}

async function updateJob(id: string, fields: Partial<JobInsert>) {
  const { error } = await admin.from("lesson_jobs").update(fields).eq("id", id);
  expect(error).toBeNull();
}

async function getLesson(id: string) {
  const { data, error } = await admin
    .from("lessons")
    .select("status, error_code, overview, spoken_language, chapters_total, chapters_ready, chapters_failed")
    .eq("id", id)
    .single();
  if (error || !data) throw error ?? new Error("lesson not found");
  return data;
}

async function chapterStatuses(lessonId: string): Promise<string[]> {
  const { data, error } = await admin.from("lesson_chapters").select("position, status").eq("lesson_id", lessonId).order("position");
  expect(error).toBeNull();
  return (data ?? []).map((c) => c.status);
}

async function claim(jobId: string, maxRunning = BIG_CAP): Promise<JobRow[]> {
  const { data, error } = await admin.rpc("claim_lesson_job", { p_job_id: jobId, p_max_running: maxRunning });
  expect(error).toBeNull();
  return data ?? [];
}

/** Fresh `running` jobs app-wide (what the concurrency cap counts). */
async function freshRunningCount(): Promise<number> {
  const { count, error } = await admin
    .from("lesson_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "running")
    .gte("locked_at", secondsFromNow(-6 * 60));
  expect(error).toBeNull();
  return count ?? 0;
}

// ---------------------------------------------------------------------------

describe("create_lesson", () => {
  it("creates the lesson and its first job once; a second call returns the same lesson and no job", async () => {
    const first = await createLesson("outline");
    const job = await getJob(first.jobId);
    expect(job).toMatchObject({ lesson_id: first.lessonId, kind: "outline", status: "queued", attempts: 0 });
    expect((await getLesson(first.lessonId)).status).toBe("queued");

    const { data, error } = await admin.rpc("create_lesson", {
      p_youtube_video_id: VIDEO_ID,
      p_output_language: "en",
      p_prompt_version: first.version,
      p_source: "gemini_video",
      p_created_by: userId,
      p_job_kind: "full",
      p_job_payload: {},
    });
    expect(error).toBeNull();
    expect(data).toEqual([{ lesson_id: first.lessonId, created: false, job_id: null }]);

    const jobs = await admin.from("lesson_jobs").select("id").eq("lesson_id", first.lessonId);
    expect(jobs.data).toEqual([{ id: first.jobId }]);
  });
});

describe("claim_lesson_job", () => {
  it("claims a due queued job once and increments attempts", async () => {
    const { jobId } = await createLesson();
    const claimed = await claim(jobId);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ id: jobId, status: "running", attempts: 1 });
    expect(Math.abs(msUntil(claimed[0].locked_at))).toBeLessThan(60_000);

    // A freshly running job can't be claimed again.
    expect(await claim(jobId)).toEqual([]);
    expect((await getJob(jobId)).attempts).toBe(1);
  });

  it("does not claim a job whose run_after is in the future", async () => {
    const { lessonId } = await createLesson();
    const job = await insertJob(lessonId, { run_after: secondsFromNow(3600) });
    expect(await claim(job.id)).toEqual([]);
    expect(await getJob(job.id)).toMatchObject({ status: "queued", attempts: 0 });
  });

  it("does not claim a done or failed job", async () => {
    const { lessonId } = await createLesson();
    const done = await insertJob(lessonId, { status: "done", attempts: 1 });
    const failed = await insertJob(lessonId, { status: "failed", attempts: 1 });
    expect(await claim(done.id)).toEqual([]);
    expect(await claim(failed.id)).toEqual([]);
    expect((await getJob(done.id)).status).toBe("done");
  });

  it("does not claim a job that has used its 3 attempts", async () => {
    const { lessonId } = await createLesson();
    const queued = await insertJob(lessonId, { attempts: 3 });
    const staleRunning = await insertJob(lessonId, { status: "running", attempts: 3, locked_at: secondsFromNow(-10 * 60) });
    expect(await claim(queued.id)).toEqual([]);
    expect(await claim(staleRunning.id)).toEqual([]);
  });

  it("reclaims a running job whose lock is older than 6 minutes", async () => {
    const { lessonId } = await createLesson();
    const stale = await insertJob(lessonId, { status: "running", attempts: 1, locked_at: secondsFromNow(-7 * 60) });
    const notStale = await insertJob(lessonId, { status: "running", attempts: 1, locked_at: secondsFromNow(-60) });

    const claimed = await claim(stale.id);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ id: stale.id, status: "running", attempts: 2 });
    expect(Math.abs(msUntil(claimed[0].locked_at))).toBeLessThan(60_000);

    expect(await claim(notStale.id)).toEqual([]);
  });

  it("respects p_max_running (app-wide fresh running jobs)", async () => {
    const { lessonId, jobId } = await createLesson();
    await insertJob(lessonId, { status: "running", attempts: 1, locked_at: secondsFromNow(-30) });
    const running = await freshRunningCount();
    expect(running).toBeGreaterThanOrEqual(1);

    expect(await claim(jobId, running)).toEqual([]);
    expect(await getJob(jobId)).toMatchObject({ status: "queued", attempts: 0 });

    const claimed = await claim(jobId, running + 1);
    expect(claimed).toHaveLength(1);
    expect(claimed[0].attempts).toBe(1);
  });
});

describe("requeue_lesson_job", () => {
  it("puts a rate-limited job back to queued, gives the attempt back and delays it", async () => {
    const { jobId } = await createLesson();
    expect(await claim(jobId)).toHaveLength(1);

    const { error } = await admin.rpc("requeue_lesson_job", { p_job_id: jobId, p_delay_seconds: 120 });
    expect(error).toBeNull();

    const job = await getJob(jobId);
    expect(job).toMatchObject({ status: "queued", attempts: 0, locked_at: null, error_code: "quota" });
    expect(msUntil(job.run_after)).toBeGreaterThan(60_000);
    expect(msUntil(job.run_after)).toBeLessThan(180_000);

    // Not claimable until run_after.
    expect(await claim(jobId)).toEqual([]);
  });

  it("never makes attempts negative and delays by at least 1 s", async () => {
    const { lessonId } = await createLesson();
    const job = await insertJob(lessonId, { attempts: 0 });
    const { error } = await admin.rpc("requeue_lesson_job", { p_job_id: job.id, p_delay_seconds: 0 });
    expect(error).toBeNull();
    const after = await getJob(job.id);
    expect(after.attempts).toBe(0);
    expect(msUntil(after.run_after)).toBeGreaterThan(-1000);
  });
});

describe("fail_lesson_job", () => {
  it("re-queues an outline job with attempts left, then fails the lesson at 3 attempts", async () => {
    const { lessonId, jobId } = await createLesson("outline");
    expect(await claim(jobId)).toHaveLength(1);

    const first = await admin.rpc("fail_lesson_job", { p_job_id: jobId, p_error_code: "invalid_output", p_retry_delay_seconds: 60 });
    expect(first.error).toBeNull();
    expect(first.data).toBe("queued");
    const queued = await getJob(jobId);
    expect(queued).toMatchObject({ status: "queued", attempts: 1, locked_at: null, error_code: "invalid_output" });
    expect(msUntil(queued.run_after)).toBeGreaterThan(30_000);
    expect((await getLesson(lessonId)).status).toBe("queued");

    await updateJob(jobId, { status: "running", attempts: 3, locked_at: secondsFromNow(0) });
    const last = await admin.rpc("fail_lesson_job", { p_job_id: jobId, p_error_code: "model_timeout", p_retry_delay_seconds: 60 });
    expect(last.data).toBe("failed");
    expect(await getJob(jobId)).toMatchObject({ status: "failed", locked_at: null, error_code: "model_timeout" });
    expect(await getLesson(lessonId)).toMatchObject({ status: "failed", error_code: "model_timeout" });
  });

  it("returns null for an unknown job", async () => {
    const { data, error } = await admin.rpc("fail_lesson_job", {
      p_job_id: crypto.randomUUID(),
      p_error_code: "unknown",
      p_retry_delay_seconds: 1,
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});

// ---------------------------------------------------------------------------

const OUTLINE = {
  spokenLanguage: "en",
  overview: "Forces, friction and momentum.",
  chapters: [
    { title: "Forces", startSeconds: 0, endSeconds: 300 },
    { title: "Friction", startSeconds: 300, endSeconds: 600 },
    { title: "Momentum", startSeconds: 600, endSeconds: 900 },
  ],
};
const BATCHES = [
  { positions: [0, 1], startSeconds: 0, endSeconds: 600 },
  { positions: [2], startSeconds: 600, endSeconds: 900 },
];

function chapterDetail(position: number, withCheckpoint: boolean, summary = `Summary of chapter ${position}.`) {
  const start = OUTLINE.chapters[position].startSeconds;
  return {
    position,
    summary,
    notesMarkdown: `Notes for chapter ${position} with $F = ma$.`,
    keyTerms: ["force", "mass"],
    formulas: ["F = ma"],
    keyMoments: [
      { seconds: start + 10, label: "Start" },
      { seconds: start + 200, label: "Example" },
    ],
    checkpoint: withCheckpoint
      ? {
          concept: "Second law",
          question: "What does F = ma relate?",
          options: ["Force, mass, acceleration", "Speed, time", "Work, energy", "Pressure, area"],
          correctIndex: 0,
          explanation: "Newton's second law relates them.",
          misconception: "Confusing mass with weight.",
        }
      : null,
    segments: [
      { startSeconds: start, endSeconds: start + 150, speech: "First half.", board: "F = ma" },
      { startSeconds: start + 150, endSeconds: start + 300, speech: "Second half.", board: null },
    ],
  };
}

async function saveBatch(lessonId: string, details: Json) {
  const { error } = await admin.rpc("save_chapter_batch", { p_lesson_id: lessonId, p_details: details });
  expect(error).toBeNull();
}

describe("save_outline → save_chapter_batch → fail → retry_chapters", () => {
  let lessonId = "";
  let batchJobs: string[] = [];

  beforeAll(async () => {
    ({ lessonId } = await createLesson("outline"));
  });

  it("save_outline writes pending chapters, sets the lesson building and inserts one chapters job per batch", async () => {
    const { data, error } = await admin.rpc("save_outline", { p_lesson_id: lessonId, p_outline: OUTLINE, p_batches: BATCHES });
    expect(error).toBeNull();
    batchJobs = data ?? [];
    expect(batchJobs).toHaveLength(2);

    expect(await chapterStatuses(lessonId)).toEqual(["pending", "pending", "pending"]);
    expect(await getLesson(lessonId)).toMatchObject({
      status: "building",
      overview: OUTLINE.overview,
      spoken_language: "en",
      chapters_total: 3,
      chapters_ready: 0,
      chapters_failed: 0,
    });
    const jobs = await Promise.all(batchJobs.map(getJob));
    expect(jobs.map((j) => [j.kind, j.status, j.attempts, j.payload])).toEqual([
      ["chapters", "queued", 0, BATCHES[0]],
      ["chapters", "queued", 0, BATCHES[1]],
    ]);
  });

  it("save_outline is idempotent", async () => {
    const { data, error } = await admin.rpc("save_outline", { p_lesson_id: lessonId, p_outline: OUTLINE, p_batches: BATCHES });
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(await chapterStatuses(lessonId)).toHaveLength(3);
    const jobs = await admin.from("lesson_jobs").select("id").eq("lesson_id", lessonId).eq("kind", "chapters");
    expect(jobs.data).toHaveLength(2);
  });

  it("save_chapter_batch marks chapters ready, assigns IDs and inserts the checkpoint question", async () => {
    await saveBatch(lessonId, [chapterDetail(0, true), chapterDetail(1, false)]);
    expect(await chapterStatuses(lessonId)).toEqual(["ready", "ready", "pending"]);
    expect(await getLesson(lessonId)).toMatchObject({ status: "building", chapters_ready: 2, chapters_total: 3 });

    const { data: chapter } = await admin
      .from("lesson_chapters")
      .select("id, summary, notes_markdown, key_terms, formulas, key_moments, segments")
      .eq("lesson_id", lessonId)
      .eq("position", 0)
      .single();
    expect(chapter).toMatchObject({
      summary: "Summary of chapter 0.",
      key_terms: ["force", "mass"],
      formulas: ["F = ma"],
      key_moments: [
        { id: "c0m0", seconds: 10, label: "Start" },
        { id: "c0m1", seconds: 200, label: "Example" },
      ],
      segments: [
        { id: "c0s0", startSeconds: 0, endSeconds: 150, speech: "First half.", board: "F = ma" },
        { id: "c0s1", startSeconds: 150, endSeconds: 300, speech: "Second half.", board: null },
      ],
    });

    const { data: questions } = await admin
      .from("questions")
      .select("source, chapter_id, youtube_video_id, at_seconds, concept, prompt, options, correct_index, explanation, misconception, owner_user_id")
      .eq("lesson_id", lessonId);
    expect(questions).toEqual([
      {
        source: "checkpoint",
        chapter_id: chapter?.id,
        youtube_video_id: VIDEO_ID,
        at_seconds: 300,
        concept: "Second law",
        prompt: "What does F = ma relate?",
        options: ["Force, mass, acceleration", "Speed, time", "Work, energy", "Pressure, area"],
        correct_index: 0,
        explanation: "Newton's second law relates them.",
        misconception: "Confusing mass with weight.",
        owner_user_id: null,
      },
    ]);
  });

  it("save_chapter_batch leaves ready chapters untouched", async () => {
    await saveBatch(lessonId, [chapterDetail(0, false, "A different summary.")]);
    const { data } = await admin.from("lesson_chapters").select("summary").eq("lesson_id", lessonId).eq("position", 0).single();
    expect(data?.summary).toBe("Summary of chapter 0.");
    const questions = await admin.from("questions").select("id").eq("lesson_id", lessonId);
    expect(questions.data).toHaveLength(1);
  });

  it("save_chapter_batch rejects an unknown position", async () => {
    const { error } = await admin.rpc("save_chapter_batch", { p_lesson_id: lessonId, p_details: [chapterDetail(0, false), { ...chapterDetail(1, false), position: 9 }] });
    expect(error).not.toBeNull();
  });

  it("fail_lesson_job re-queues a chapters job with attempts left, and at 3 attempts fails only its chapters", async () => {
    const jobId = batchJobs[1];
    expect(await claim(jobId)).toHaveLength(1);
    const retry = await admin.rpc("fail_lesson_job", { p_job_id: jobId, p_error_code: "invalid_output", p_retry_delay_seconds: 15 });
    expect(retry.data).toBe("queued");
    expect(await chapterStatuses(lessonId)).toEqual(["ready", "ready", "pending"]);

    await updateJob(jobId, { status: "running", attempts: 3, locked_at: secondsFromNow(0) });
    const failed = await admin.rpc("fail_lesson_job", { p_job_id: jobId, p_error_code: "invalid_output", p_retry_delay_seconds: 15 });
    expect(failed.data).toBe("failed");
    expect((await getJob(jobId)).status).toBe("failed");
    expect(await chapterStatuses(lessonId)).toEqual(["ready", "ready", "failed"]);
    // Every chapter is ready or failed and at least one is ready: the lesson is usable.
    expect(await getLesson(lessonId)).toMatchObject({ status: "ready", chapters_ready: 2, chapters_failed: 1, error_code: null });
  });

  it("retry_chapters resets the failed job and its chapters", async () => {
    const jobId = batchJobs[1];
    const { data, error } = await admin.rpc("retry_chapters", { p_lesson_id: lessonId, p_position: 2 });
    expect(error).toBeNull();
    expect(data).toEqual([jobId]);
    expect(await getJob(jobId)).toMatchObject({ status: "queued", attempts: 0, locked_at: null, error_code: null });
    expect(await chapterStatuses(lessonId)).toEqual(["ready", "ready", "pending"]);
    expect(await getLesson(lessonId)).toMatchObject({ status: "building", chapters_ready: 2, chapters_failed: 0 });

    // Nothing to retry for a ready chapter.
    const none = await admin.rpc("retry_chapters", { p_lesson_id: lessonId, p_position: 0 });
    expect(none.data).toEqual([]);
  });

  it("the lesson becomes ready when every chapter is done", async () => {
    await saveBatch(lessonId, [chapterDetail(2, true)]);
    expect(await chapterStatuses(lessonId)).toEqual(["ready", "ready", "ready"]);
    expect(await getLesson(lessonId)).toMatchObject({ status: "ready", chapters_ready: 3, chapters_failed: 0, chapters_total: 3 });
    const questions = await admin.from("questions").select("id").eq("lesson_id", lessonId);
    expect(questions.data).toHaveLength(2);
  });

  it("a lesson whose every chapter failed is failed", async () => {
    const { lessonId: other } = await createLesson("outline");
    const { data: jobs } = await admin.rpc("save_outline", { p_lesson_id: other, p_outline: OUTLINE, p_batches: [{ positions: [0, 1, 2], startSeconds: 0, endSeconds: 900 }] });
    const jobId = jobs?.[0] ?? "";
    await updateJob(jobId, { status: "running", attempts: 3, locked_at: secondsFromNow(0) });
    const failed = await admin.rpc("fail_lesson_job", { p_job_id: jobId, p_error_code: "quota", p_retry_delay_seconds: 15 });
    expect(failed.data).toBe("failed");
    expect(await chapterStatuses(other)).toEqual(["failed", "failed", "failed"]);
    expect((await getLesson(other)).status).toBe("failed");
  });
});

// ---------------------------------------------------------------------------

describe("dispatchable_jobs", () => {
  let lessonId = "";
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const created = await createLesson("outline");
    lessonId = created.lessonId;
    await updateJob(created.jobId, { status: "done", attempts: 1 });
    ids.oldest = (await insertJob(lessonId, { run_after: secondsFromNow(-120) })).id;
    ids.older = (await insertJob(lessonId, { run_after: secondsFromNow(-60) })).id;
    ids.stale = (await insertJob(lessonId, { status: "running", attempts: 1, run_after: secondsFromNow(-30), locked_at: secondsFromNow(-7 * 60) })).id;
    ids.future = (await insertJob(lessonId, { run_after: secondsFromNow(3600) })).id;
    ids.exhausted = (await insertJob(lessonId, { attempts: 3, run_after: secondsFromNow(-300) })).id;
    ids.done = (await insertJob(lessonId, { status: "done", attempts: 1, run_after: secondsFromNow(-300) })).id;
    ids.failed = (await insertJob(lessonId, { status: "failed", attempts: 3, run_after: secondsFromNow(-300) })).id;
    ids.fresh = (await insertJob(lessonId, { status: "running", attempts: 1, run_after: secondsFromNow(-300), locked_at: secondsFromNow(-30) })).id;
  });

  async function dispatchable(maxRunning: number): Promise<string[]> {
    const { data, error } = await admin.rpc("dispatchable_jobs", { p_max_running: maxRunning, p_lesson_id: lessonId });
    expect(error).toBeNull();
    return data ?? [];
  }

  it("returns due queued jobs and stale running jobs, oldest first", async () => {
    const running = await freshRunningCount();
    expect(await dispatchable(running + 10)).toEqual([ids.oldest, ids.older, ids.stale]);
  });

  it("returns at most the free slots under the cap", async () => {
    const running = await freshRunningCount();
    expect(running).toBeGreaterThanOrEqual(1); // ids.fresh
    expect(await dispatchable(running + 1)).toEqual([ids.oldest]);
    expect(await dispatchable(running + 2)).toEqual([ids.oldest, ids.older]);
    expect(await dispatchable(running)).toEqual([]);
    expect(await dispatchable(0)).toEqual([]);
  });

  it("only returns jobs of the requested lesson", async () => {
    const { jobId: otherJob } = await createLesson("outline");
    const running = await freshRunningCount();
    const mine = await dispatchable(running + 10);
    expect(mine).not.toContain(otherJob);
    const theirs = await admin.rpc("dispatchable_jobs", { p_max_running: running + 10, p_lesson_id: (await getJob(otherJob)).lesson_id });
    expect(theirs.data).toEqual([otherJob]);
  });
});
