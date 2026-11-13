import "server-only";

/**
 * Run one claimed job (Section 5.4). Called from the internal run route inside `after()`.
 */
import { OUTPUT_LANGUAGES, type OutputLanguage } from "@/config/enums";
import { isRateLimitError, jobErrorCode, retryAfterSeconds } from "@/lib/ai/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

import { dispatchNext } from "./dispatch";
import { runChapters } from "./runners/chapters";
import { runFull } from "./runners/full";
import { runOutline } from "./runners/outline";
import { runTranscript } from "./runners/transcript";
import type { JobRow, LessonContext, RunnerResult } from "./runners/types";

const BASE_BACKOFF_SECONDS = 30;
const MAX_BACKOFF_SECONDS = 300;
const FAILURE_RETRY_SECONDS = 15;

/** Exponential backoff for rate limits, honouring retry-after. Pure, exported for tests. */
export function rateLimitDelaySeconds(previousRateLimits: number, retryAfter: number | null): number {
  const exponential = Math.min(MAX_BACKOFF_SECONDS, BASE_BACKOFF_SECONDS * 2 ** Math.max(0, previousRateLimits));
  return retryAfter !== null ? Math.min(MAX_BACKOFF_SECONDS, Math.max(retryAfter, 1)) : exponential;
}

async function loadLesson(lessonId: string): Promise<LessonContext> {
  const { data, error } = await createAdminClient()
    .from("lessons")
    .select("id, youtube_video_id, output_language, overview, videos(duration_seconds)")
    .eq("id", lessonId)
    .single();
  if (error || !data || !data.videos) throw new Error("run-job: lesson not found");
  return {
    id: data.id,
    youtubeVideoId: data.youtube_video_id,
    language: (OUTPUT_LANGUAGES as readonly string[]).includes(data.output_language) ? (data.output_language as OutputLanguage) : "en",
    overview: data.overview,
    durationSeconds: data.videos.duration_seconds,
  };
}

function payloadObject(payload: Json): Record<string, Json | undefined> {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload) ? payload : {};
}

export async function runClaimedJob(job: JobRow): Promise<void> {
  const admin = createAdminClient();
  try {
    const lesson = await loadLesson(job.lesson_id);
    if (job.kind !== "chapters") {
      await admin.from("lessons").update({ status: "outlining" }).eq("id", lesson.id).in("status", ["queued", "outlining"]);
    }

    let result: RunnerResult;
    switch (job.kind) {
      case "full":
        result = await runFull(lesson);
        break;
      case "outline":
        result = await runOutline(lesson);
        break;
      case "chapters":
        result = await runChapters(lesson, job);
        break;
      case "transcript":
        result = await runTranscript(lesson, job);
        break;
      default:
        throw new Error(`run-job: unknown kind ${job.kind}`);
    }

    await admin.rpc("complete_lesson_job", {
      p_job_id: job.id,
      p_input_tokens: result.usage.inputTokens,
      p_output_tokens: result.usage.outputTokens,
      p_generation_ms: Math.round(result.usage.durationMs),
      p_provider: result.spec.provider,
      p_model: result.spec.modelId,
    });
  } catch (error) {
    if (isRateLimitError(error)) {
      const payload = payloadObject(job.payload);
      const previous = typeof payload.rateLimits === "number" ? payload.rateLimits : 0;
      const delay = rateLimitDelaySeconds(previous, retryAfterSeconds(error));
      await admin.from("lesson_jobs").update({ payload: { ...payload, rateLimits: previous + 1 } }).eq("id", job.id);
      await admin.rpc("requeue_lesson_job", { p_job_id: job.id, p_delay_seconds: delay });
    } else {
      const code = jobErrorCode(error);
      console.error(`[jobs] ${job.kind} job ${job.id} failed (${code}):`, error instanceof Error ? error.name : "unknown");
      await admin.rpc("fail_lesson_job", { p_job_id: job.id, p_error_code: code, p_retry_delay_seconds: FAILURE_RETRY_SECONDS });
    }
  } finally {
    await dispatchNext();
  }
}
