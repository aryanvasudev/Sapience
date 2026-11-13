/**
 * Lesson pipeline integration (Section 12.1): a transcript lesson runs end to end through the
 * real job runner, validators and database functions, with the model replaced by
 * `MockLanguageModelV4`. Runs against the LOCAL Supabase stack only:
 *
 *   pnpm db:start && pnpm test:rls
 *
 * transcript job → outline (mock) → save_outline → chapters job → details (mock) →
 * save_chapter_batch → lesson `ready`, with notes, a checkpoint and the code-built lecture index.
 */
import { existsSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MockLanguageModelV4 } from "ai/test";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Database, Json } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!secretKey) throw new Error("Pipeline test needs SUPABASE_SECRET_KEY for the local stack.");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url.replace(/\/$/, ""))) {
  throw new Error(`Refusing to run the pipeline test against a non-local Supabase URL: ${url}`);
}

const DURATION = 600;
const VIDEO_ID = `pt${crypto.randomUUID().replace(/-/g, "").slice(0, 9)}`;
const SEGMENTS = Array.from({ length: DURATION / 30 }, (_, i) => ({
  startSeconds: i * 30,
  endSeconds: (i + 1) * 30,
  speech: `Segment ${i + 1}: the lecturer explains polymer chains, repeat units and molar mass, part ${i + 1}.`,
  board: null,
}));

// ---------------------------------------------------------------------------
// Mock model: answers the outline call, then each chapter batch for exactly the positions asked.
// ---------------------------------------------------------------------------

type CallOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0];
type GenerateResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;

const promptText = (options: CallOptions) =>
  options.prompt
    .flatMap((m) =>
      typeof m.content === "string" ? [m.content] : m.content.flatMap((p) => (p.type === "text" ? [p.text] : [])),
    )
    .join("\n");

const result = (value: unknown): GenerateResult => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
  finishReason: { unified: "stop", raw: "stop" },
  usage: {
    inputTokens: { total: 1000, noCache: 1000, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 200, text: 200, reasoning: 0 },
  },
  warnings: [],
});

const outline = {
  spokenLanguage: "en",
  overview: "An introduction to polymers: what repeat units are and how molar mass is described.",
  chapters: [
    { title: "Repeat units and chains", startSeconds: 0, endSeconds: 300 },
    { title: "Describing molar mass", startSeconds: 300, endSeconds: 600 },
  ],
};

const detail = (position: number) => ({
  position,
  summary: `Chapter ${position + 1} summary: how chains are built from repeat units.`,
  notesMarkdown: `## Chapter ${position + 1}\n\n- A **polymer** is a long chain of repeat units.\n- $M_n$ is the number-average molar mass.`,
  keyTerms: ["polymer", "repeat unit"],
  formulas: ["M_n = \\frac{\\sum N_i M_i}{\\sum N_i}"],
  keyMoments: [{ seconds: position * 300 + 60, label: "Definition of a repeat unit" }],
  checkpoint: {
    concept: "Repeat unit",
    question: "What is the smallest structure that repeats along a polymer chain?",
    options: ["The repeat unit", "The end group", "The solvent", "The crosslink"],
    correctIndex: 0,
    explanation: "A polymer chain is built by repeating the same small structure: the repeat unit.",
    misconception: "End groups only appear at the two ends of the chain.",
  },
});

const calls: string[] = [];
const mockModel = new MockLanguageModelV4({
  provider: "mock",
  modelId: "mock-lesson",
  doGenerate: async (options) => {
    const text = promptText(options);
    const positions = [...text.matchAll(/<chapter position="(\d+)"/g)].map((m) => Number(m[1]));
    if (positions.length === 0) {
      calls.push("outline");
      return result(outline);
    }
    calls.push(`chapters:${positions.join(",")}`);
    return result({ chapters: positions.map(detail) });
  },
});

vi.mock("@/lib/ai/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/provider")>();
  return { ...actual, languageModel: () => mockModel };
});
// Dispatch would call the app's internal run route; the test claims and runs jobs itself.
vi.mock("@/lib/jobs/dispatch", () => ({ dispatchNext: async () => {} }));

const { runClaimedJob } = await import("@/lib/jobs/run-job");
const { serverEnv } = await import("@/env");

const admin: SupabaseClient<Database> = createClient<Database>(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

let userId = "";
let lessonId = "";

beforeAll(async () => {
  const user = await admin.auth.admin.createUser({ email: `pipeline-${crypto.randomUUID()}@example.test`, email_confirm: true });
  if (user.error || !user.data.user) throw user.error ?? new Error("createUser failed");
  userId = user.data.user.id;
  const video = await admin
    .from("videos")
    .insert({ youtube_video_id: VIDEO_ID, title: "Pipeline test video", duration_seconds: DURATION });
  if (video.error) throw video.error;
});

afterAll(async () => {
  if (lessonId) await admin.from("ai_calls").delete().eq("lesson_id", lessonId);
  await admin.from("lessons").delete().eq("youtube_video_id", VIDEO_ID);
  await admin.from("videos").delete().eq("youtube_video_id", VIDEO_ID);
  if (userId) await admin.auth.admin.deleteUser(userId);
});

async function runQueuedJobs(): Promise<number> {
  const { data: queued } = await admin
    .from("lesson_jobs")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("status", "queued")
    .order("created_at");
  let ran = 0;
  for (const { id } of queued ?? []) {
    const { data: claimed, error } = await admin.rpc("claim_lesson_job", { p_job_id: id, p_max_running: 1000 });
    expect(error).toBeNull();
    for (const job of claimed ?? []) {
      await runClaimedJob(job);
      ran++;
    }
  }
  return ran;
}

describe("transcript lesson pipeline (mock model)", () => {
  it("builds a ready lesson from a pasted transcript", async () => {
    const { data: created, error } = await admin.rpc("create_lesson", {
      p_youtube_video_id: VIDEO_ID,
      p_output_language: "en",
      p_prompt_version: serverEnv().PROMPT_VERSION,
      p_source: "transcript_paste",
      p_created_by: userId,
      p_job_kind: "transcript",
      p_job_payload: { segments: SEGMENTS } as unknown as Json,
    });
    expect(error).toBeNull();
    lessonId = created![0].lesson_id;

    // 1. Outline.
    expect(await runQueuedJobs()).toBe(1);
    const afterOutline = await admin.from("lesson_chapters").select("title").eq("lesson_id", lessonId).order("position");
    expect(afterOutline.data?.map((c) => c.title)).toEqual(outline.chapters.map((c) => c.title));

    // 2. Chapter batches (one or more, depending on LESSON_BATCH_MAX_MINUTES).
    for (let round = 0; round < 5 && (await runQueuedJobs()) > 0; round++);

    const { data: lesson } = await admin.from("lessons").select("*").eq("id", lessonId).single();
    expect(lesson?.status).toBe("ready");
    expect(lesson?.overview).toBe(outline.overview);

    const { data: chapters } = await admin.from("lesson_chapters").select("*").eq("lesson_id", lessonId).order("position");
    expect(chapters).toHaveLength(2);
    for (const c of chapters ?? []) {
      expect(c.status).toBe("ready");
      expect(c.notes_markdown).toContain("repeat units");
      // The lecture index comes from the transcript, not the model.
      const segs = c.segments as { startSeconds: number; speech: string }[];
      expect(segs.length).toBeGreaterThan(0);
      expect(segs.every((s) => s.startSeconds >= c.start_seconds && s.startSeconds < c.end_seconds)).toBe(true);
      expect(segs[0].speech).toMatch(/^Segment \d+:/);
    }

    const { data: questions } = await admin.from("questions").select("source, correct_index").eq("lesson_id", lessonId);
    expect(questions).toHaveLength(2);
    expect(questions?.every((q) => q.source === "checkpoint" && q.correct_index === 0)).toBe(true);

    // Every model call went to the mock and was recorded.
    expect(calls[0]).toBe("outline");
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const { count } = await admin.from("ai_calls").select("id", { count: "exact", head: true }).eq("lesson_id", lessonId);
    expect(count).toBe(calls.length);
  });
});
