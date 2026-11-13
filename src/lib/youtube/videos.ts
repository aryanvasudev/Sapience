import "server-only";

/**
 * Video lookup and eligibility (Section 5.1): YouTube Data API `videos.list` only, cached in the
 * `videos` table and re-checked after 24 hours.
 */
import { z } from "zod";

import { serverEnv } from "@/env";
import { AppError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { VideoPublic } from "@/types/contracts";

import { parseIsoDuration } from "./duration";

const RECHECK_AFTER_MS = 24 * 60 * 60 * 1000;
const MIN_SECONDS = 60;

const VideosListSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.object({
          title: z.string(),
          channelTitle: z.string().optional(),
          liveBroadcastContent: z.string().optional(),
          thumbnails: z.record(z.string(), z.object({ url: z.string() })).optional(),
        }),
        contentDetails: z.object({
          duration: z.string(),
          contentRating: z.object({ ytRating: z.string().optional() }).loose().optional(),
        }),
        status: z.object({ privacyStatus: z.string(), embeddable: z.boolean() }),
      }),
    )
    .default([]),
});

export type VideoRecord = VideoPublic & { privacyStatus: string | null; embeddable: boolean | null };

function bestThumbnail(thumbnails: Record<string, { url: string }> | undefined): string | null {
  if (!thumbnails) return null;
  for (const key of ["maxres", "standard", "high", "medium", "default"]) {
    const url = thumbnails[key]?.url;
    if (url?.startsWith("https://i.ytimg.com/")) return url;
  }
  return null;
}

/** Throws the specific AppError for an ineligible video. */
function assertEligible(video: VideoRecord) {
  if (video.privacyStatus !== "public") throw new AppError("video_private");
  if (video.embeddable !== true) throw new AppError("video_not_embeddable");
  const maxSeconds = serverEnv().LESSON_MAX_VIDEO_MINUTES * 60;
  if (video.durationSeconds < MIN_SECONDS || video.durationSeconds > maxSeconds) {
    throw new AppError(
      "video_duration",
      `Lessons work for videos between 1 and ${serverEnv().LESSON_MAX_VIDEO_MINUTES} minutes.`,
    );
  }
}

async function fetchFromYouTube(videoId: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,contentDetails,status");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", serverEnv().YOUTUBE_API_KEY);

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch {
    throw new AppError("youtube_quota");
  }
  if (response.status === 403 || response.status === 429) throw new AppError("youtube_quota");
  if (!response.ok) {
    console.error("[youtube] videos.list failed with status", response.status);
    throw new AppError("internal");
  }
  const parsed = VideosListSchema.safeParse(await response.json());
  if (!parsed.success) throw new AppError("internal");
  return parsed.data.items[0] ?? null;
}

/**
 * The video's metadata, validated for lesson building. Uses the cache when it is fresher than
 * 24 h; otherwise asks YouTube and upserts the cache.
 */
export async function getEligibleVideo(videoId: string): Promise<VideoRecord> {
  const admin = createAdminClient();
  const { data: cached } = await admin.from("videos").select("*").eq("youtube_video_id", videoId).maybeSingle();

  if (cached && Date.now() - new Date(cached.checked_at).getTime() < RECHECK_AFTER_MS) {
    const video = rowToRecord(cached);
    assertEligible(video);
    return video;
  }

  const item = await fetchFromYouTube(videoId);
  if (!item) throw new AppError("video_not_found");

  if (item.snippet.liveBroadcastContent && item.snippet.liveBroadcastContent !== "none") throw new AppError("video_live");
  if (item.contentDetails.contentRating?.ytRating === "ytAgeRestricted") throw new AppError("video_age_restricted");
  const durationSeconds = parseIsoDuration(item.contentDetails.duration);
  if (durationSeconds === null || durationSeconds === 0) throw new AppError("video_live");

  const row = {
    youtube_video_id: videoId,
    title: item.snippet.title.slice(0, 500),
    channel_title: item.snippet.channelTitle?.slice(0, 200) ?? null,
    duration_seconds: durationSeconds,
    thumbnail_url: bestThumbnail(item.snippet.thumbnails),
    privacy_status: item.status.privacyStatus,
    embeddable: item.status.embeddable,
    checked_at: new Date().toISOString(),
  };
  const { error } = await admin.from("videos").upsert(row);
  if (error) console.error("[videos] cache upsert failed:", error.code);

  const video = rowToRecord(row);
  assertEligible(video);
  return video;
}

/** Cached metadata only (no YouTube call, no eligibility check), e.g. for opening an existing lesson. */
export async function getCachedVideo(videoId: string): Promise<VideoRecord | null> {
  const { data } = await createAdminClient().from("videos").select("*").eq("youtube_video_id", videoId).maybeSingle();
  return data ? rowToRecord(data) : null;
}

type VideoRow = {
  youtube_video_id: string;
  title: string;
  channel_title: string | null;
  duration_seconds: number;
  thumbnail_url: string | null;
  privacy_status: string | null;
  embeddable: boolean | null;
};

function rowToRecord(row: VideoRow): VideoRecord {
  return {
    youtubeVideoId: row.youtube_video_id,
    title: row.title,
    channelTitle: row.channel_title,
    durationSeconds: row.duration_seconds,
    thumbnailUrl: row.thumbnail_url,
    privacyStatus: row.privacy_status,
    embeddable: row.embeddable,
  };
}

export function toVideoPublic(video: VideoRecord): VideoPublic {
  return {
    youtubeVideoId: video.youtubeVideoId,
    title: video.title,
    channelTitle: video.channelTitle,
    durationSeconds: video.durationSeconds,
    thumbnailUrl: video.thumbnailUrl,
  };
}
