import "server-only";

/**
 * Lesson service (Section 5.4): open or create a lesson, read its public status (with the
 * watchdog), and retry failures. Route handlers authenticate and validate, then call these.
 */
import { after } from "next/server";

import type { LessonStatus, OutputLanguage } from "@/config/enums";
import { serverEnv } from "@/env";
import { byokEnabled, lessonKey, userKeyFor } from "@/lib/ai/byok";
import { capabilities, runWithUserKey } from "@/lib/ai/provider";
import type { CurrentUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { dispatchNext, failAbandonedJobs } from "@/lib/jobs/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseTranscript, type TranscriptLine } from "@/lib/transcript/parse";
import { segmentTranscript, type TranscriptSegment } from "@/lib/transcript/segment";
import { fetchCaptionLines } from "@/lib/youtube/captions";
import { parseYouTubeUrl } from "@/lib/youtube/parse-url";
import { getCachedVideo, getEligibleVideo, toVideoPublic, type VideoRecord } from "@/lib/youtube/videos";
import type { CreateLessonResponse, LessonStatusResponse } from "@/types/contracts";
import type { Json } from "@/types/database";

import { serializeLesson } from "./public-serializer";

/** A failed lesson may be retried once it has been failed for this long (Section 5.4). */
const RETRY_MIN_AGE_SECONDS = 120;
const WATCHDOG_INTERVAL_MS = 30_000;
const MIN_TRANSCRIPT_LINES = 5;

type FirstJob = { kind: "full" | "outline" | "transcript"; payload: Json; source: "gemini_video" | "transcript_paste" };

/** A transcript job from timestamped lines, or null if there's too little to build from. */
function transcriptJob(lines: TranscriptLine[], durationSeconds: number): FirstJob | null {
  const segments: TranscriptSegment[] = segmentTranscript(lines, durationSeconds);
  if (segments.length < 1 || lines.length < MIN_TRANSCRIPT_LINES) return null;
  return { kind: "transcript", payload: { segments }, source: "transcript_paste" };
}

function videoJob(video: VideoRecord): FirstJob {
  const singlePass = video.durationSeconds <= serverEnv().LESSON_SINGLE_PASS_MAX_MINUTES * 60;
  return { kind: singlePass ? "full" : "outline", payload: {}, source: "gemini_video" };
}

/**
 * How to build a new lesson. A pasted transcript is used as is. Otherwise, in `captions` mode the
 * video's YouTube captions are used, and only a video without readable captions goes to the video
 * model, on the student's own key. In `video` mode the video model watches it (app key or theirs).
 */
async function planFirstJob(video: VideoRecord, transcript: string | undefined, userId: string, language: OutputLanguage): Promise<FirstJob> {
  if (transcript !== undefined) {
    const job = transcriptJob(parseTranscript(transcript), video.durationSeconds);
    if (!job) {
      throw new AppError(
        "bad_request",
        "That transcript has no timestamps Sapience can read. On YouTube, open ⋯ → Show transcript, select everything in the panel, and paste it here.",
      );
    }
    return job;
  }

  if (serverEnv().LESSON_BUILD_MODE === "captions") {
    const [lines, key] = await Promise.all([fetchCaptionLines(video.youtubeVideoId, language), userKeyFor(userId, "video")]);
    const job = lines ? transcriptJob(lines, video.durationSeconds) : null;
    if (job) return job;
    if (key) return videoJob(video);
    throw new AppError(byokEnabled() ? "video_needs_key" : "video_ai_unavailable");
  }

  // With the student's own key, what their key can do decides (e.g. a Gemini key enables video).
  const key = await userKeyFor(userId, "video");
  if (!runWithUserKey(key, () => capabilities().videoLessons)) throw new AppError("video_ai_unavailable");
  return videoJob(video);
}

async function findLesson(videoId: string, language: OutputLanguage) {
  const { data, error } = await createAdminClient()
    .from("lessons")
    .select("id, status, source, updated_at")
    .eq("youtube_video_id", videoId)
    .eq("output_language", language)
    .eq("prompt_version", serverEnv().PROMPT_VERSION)
    .maybeSingle();
  if (error) throw new AppError("internal");
  return data;
}

/** POST /api/lessons. Opening an existing lesson is free; building a new one counts. */
export async function openOrCreateLesson(input: {
  user: CurrentUser;
  url: string;
  language: OutputLanguage;
  transcript?: string;
}): Promise<CreateLessonResponse> {
  const parsed = parseYouTubeUrl(input.url);
  if (!parsed) throw new AppError("invalid_url");
  const startSeconds = parsed.startSeconds ?? undefined;
  const respond = (status: LessonStatus): CreateLessonResponse => ({
    youtubeVideoId: parsed.videoId,
    language: input.language,
    status,
    ...(startSeconds !== undefined ? { startSeconds } : {}),
  });

  const existing = await findLesson(parsed.videoId, input.language);
  if (existing && existing.status !== "failed") return respond(existing.status as LessonStatus);

  const video = await getEligibleVideo(parsed.videoId);
  const admin = createAdminClient();
  const job = await planFirstJob(video, input.transcript, input.user.id, input.language);
  const role = job.source === "gemini_video" ? "video" : "text";

  if (existing) {
    // Failed: retrying counts against the limit, and only after a short cool-down.
    const ageSeconds = (Date.now() - new Date(existing.updated_at).getTime()) / 1000;
    if (ageSeconds < RETRY_MIN_AGE_SECONDS) return respond("failed");
    const key = await lessonKey(input.user, role);
    const { data: jobId, error } = await admin.rpc("restart_lesson", {
      p_lesson_id: existing.id,
      p_source: job.source,
      p_job_kind: job.kind,
      p_job_payload: job.payload,
      p_min_age_seconds: RETRY_MIN_AGE_SECONDS,
      p_byok_user_id: key?.userId,
    });
    if (error) throw new AppError("internal");
    if (jobId) after(() => dispatchNext(existing.id));
    return respond(jobId ? "queued" : "failed");
  }

  // Counts against the daily limits, unless the student builds it on their own key.
  const key = await lessonKey(input.user, role);
  const { data, error } = await admin.rpc("create_lesson", {
    p_youtube_video_id: video.youtubeVideoId,
    p_output_language: input.language,
    p_prompt_version: serverEnv().PROMPT_VERSION,
    p_source: job.source,
    p_created_by: input.user.id,
    p_job_kind: job.kind,
    p_job_payload: job.payload,
    p_byok_user_id: key?.userId,
  });
  const row = data?.[0];
  if (error || !row) throw new AppError("internal");
  after(() => dispatchNext(row.lesson_id));
  if (!row.created) {
    const raced = await findLesson(parsed.videoId, input.language);
    return respond((raced?.status as LessonStatus | undefined) ?? "queued");
  }
  return respond("queued");
}

/** Re-dispatch stuck work at most once per 30 s per lesson (Section 5.4 watchdog). */
async function nudge(lessonId: string) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - WATCHDOG_INTERVAL_MS).toISOString();
  const { data } = await createAdminClient()
    .from("lessons")
    .update({ last_nudged_at: now.toISOString() })
    .eq("id", lessonId)
    .or(`last_nudged_at.is.null,last_nudged_at.lt.${cutoff}`)
    .select("id");
  if (data && data.length > 0) await Promise.all([failAbandonedJobs(lessonId), dispatchNext(lessonId)]);
}

/**
 * GET /api/lessons/[videoId]: the public lesson (answers stripped), progress, the user's first
 * attempt per checkpoint, and capabilities. Returns null if there is no lesson for this video
 * and language yet.
 */
export async function getLessonStatus(input: {
  user: CurrentUser;
  videoId: string;
  language: OutputLanguage;
}): Promise<LessonStatusResponse | null> {
  const [video, bundles] = await Promise.all([getCachedVideo(input.videoId), loadLessonBundles(input.videoId, input.language)]);
  return lessonStatusFrom(video, bundles.find((b) => b.output_language === input.language) ?? null);
}

/**
 * The lesson row with its chapters, answer-free checkpoints (correct_index / explanation /
 * misconception stay on the server) and a count of jobs parked on quota, embedded so the whole
 * lesson arrives in one round trip. The `!…_fkey` hints pin each embed to its direct foreign key:
 * `questions` also links lessons to chapters, which PostgREST would otherwise call ambiguous.
 */
const LESSON_BUNDLE =
  "id, youtube_video_id, output_language, source, status, spoken_language, overview, chapters_total, chapters_ready, lesson_chapters!lesson_chapters_lesson_id_fkey(id, position, status, title, start_seconds, end_seconds, summary, notes_markdown, key_terms, formulas, key_moments, segments), questions!questions_lesson_id_fkey(id, chapter_id, concept, prompt, options, at_seconds), lesson_jobs!lesson_jobs_lesson_id_fkey(count)";

/**
 * Current-version lessons for a video, one per output language (only `language` when given),
 * each with everything `lessonStatusFrom` needs. Without a language, a page can start this before
 * it knows which language to show and pick the row afterwards.
 */
export async function loadLessonBundles(videoId: string, language?: OutputLanguage) {
  let query = createAdminClient()
    .from("lessons")
    .select(LESSON_BUNDLE)
    .eq("youtube_video_id", videoId)
    .eq("prompt_version", serverEnv().PROMPT_VERSION)
    .eq("questions.source", "checkpoint")
    .eq("lesson_jobs.status", "queued")
    .eq("lesson_jobs.error_code", "quota");
  if (language) query = query.eq("output_language", language);
  const { data } = await query;
  return data ?? [];
}

export type LessonBundle = Awaited<ReturnType<typeof loadLessonBundles>>[number];

/**
 * The public lesson status from a loaded bundle, adding the student's first attempt per checkpoint.
 * Pass `watchdog: false` where `after()` can't run (a cache scope, a prefetch). The lesson screen
 * polls GET /api/lessons/[videoId] while a lesson builds, and that route runs the watchdog.
 */
export async function lessonStatusFrom(
  video: VideoRecord | null,
  bundle: LessonBundle | null,
  { watchdog = true }: { watchdog?: boolean } = {},
): Promise<LessonStatusResponse | null> {
  if (!video || !bundle) return null;
  const { lesson_chapters: chapters, questions, lesson_jobs: waiting, ...lesson } = bundle;

  const questionIds = questions.map((q) => q.id);
  const attempts: LessonStatusResponse["attempts"] = {};
  if (questionIds.length > 0) {
    const supabase = await createClient();
    const { data: rows } = await supabase
      .from("question_attempts")
      .select("question_id, is_correct, created_at")
      .in("question_id", questionIds)
      .order("created_at", { ascending: true });
    for (const row of rows ?? []) {
      if (!attempts[row.question_id]) attempts[row.question_id] = { isCorrect: row.is_correct };
    }
  }

  const publicLesson = serializeLesson(lesson, chapters, questions);
  // The watchdog never changes this response, so it runs after it is sent.
  if (watchdog && stillBuilding(publicLesson)) after(() => nudge(lesson.id));

  return {
    status: publicLesson.status,
    progress: { chaptersReady: lesson.chapters_ready, chaptersTotal: lesson.chapters_total },
    video: toVideoPublic(video),
    lesson: publicLesson,
    attempts,
    capabilities: capabilities(),
    waitingForCapacity: (waiting[0]?.count ?? 0) > 0,
  };
}

function stillBuilding(lesson: NonNullable<LessonStatusResponse["lesson"]>): boolean {
  const inProgress = lesson.status !== "ready" && lesson.status !== "failed";
  return (inProgress || lesson.chapters.some((c) => c.status === "pending")) && lesson.source !== "fixture";
}

/** POST /api/lessons/[videoId]/retry. A chapter retry is free; a whole-lesson retry counts. */
export async function retryLesson(input: {
  user: CurrentUser;
  videoId: string;
  language: OutputLanguage;
  chapterPosition?: number;
}): Promise<{ status: LessonStatus }> {
  const lesson = await findLesson(input.videoId, input.language);
  if (!lesson) throw new AppError("not_found");

  if (input.chapterPosition !== undefined) {
    const { data, error } = await createAdminClient().rpc("retry_chapters", {
      p_lesson_id: lesson.id,
      p_position: input.chapterPosition,
    });
    if (error) throw new AppError("internal");
    if ((data ?? []).length > 0) after(() => dispatchNext(lesson.id));
    const updated = await findLesson(input.videoId, input.language);
    return { status: (updated?.status ?? lesson.status) as LessonStatus };
  }

  if (lesson.status !== "failed") return { status: lesson.status as LessonStatus };
  const result = await openOrCreateLesson({
    user: input.user,
    url: `https://www.youtube.com/watch?v=${input.videoId}`,
    language: input.language,
  });
  return { status: result.status };
}
