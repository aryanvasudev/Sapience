/**
 * Typed application errors → safe JSON `{ error: { code, message } }` (Section 8, 10).
 * Never includes stack traces or provider messages.
 */
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";

import type { AppErrorCode } from "@/config/enums";

const STATUS: Record<AppErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  payload_too_large: 413,
  internal: 500,
  invalid_url: 400,
  video_not_found: 404,
  video_private: 422,
  video_not_embeddable: 422,
  video_age_restricted: 422,
  video_live: 422,
  video_duration: 422,
  youtube_quota: 503,
  video_ai_unavailable: 422,
  video_needs_key: 422,
  lesson_daily_limit: 429,
  guest_lesson_limit: 429,
  global_lesson_limit: 429,
  ai_daily_limit: 429,
  ai_busy: 503,
  grading_failed: 500,
};

/** The student-facing copy from Section 10. Some are refined with a `{limit}` at the call site. */
export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  bad_request: "Something in that request wasn't right. Refresh the page and try again.",
  unauthorized: "Sign in to continue.",
  forbidden: "You don't have access to that.",
  not_found: "That doesn't exist.",
  payload_too_large: "That's too much text to send at once.",
  internal: "Something went wrong on our side. Try again.",
  invalid_url: "That doesn't look like a YouTube video link.",
  video_not_found: "That video doesn't exist or isn't public. Sapience can only build lessons from public videos.",
  video_private: "Sapience can only build lessons from public videos.",
  video_not_embeddable: "This video's owner doesn't allow it to play outside YouTube.",
  video_age_restricted: "Sapience can't build lessons from age-restricted videos.",
  video_live: "Live streams can't be turned into lessons until they've finished.",
  video_duration: "Lessons work for videos between 1 and 90 minutes.",
  youtube_quota: "Video lookup is busy. Try again in a few minutes.",
  video_ai_unavailable: "Paste this video's transcript to build the lesson.",
  video_needs_key:
    "This video has no captions Sapience can read. With your own free Gemini key, Sapience can build the lesson from the video itself.",
  lesson_daily_limit: "You've built your new lessons for today. Lessons that already exist still open.",
  guest_lesson_limit: "Create a free account to build more lessons today.",
  global_lesson_limit: "Sapience is busy today. Try a featured lesson.",
  ai_daily_limit: "You've reached today's tutor limit. It resets at midnight IST.",
  ai_busy:
    "Sapience runs on free AI capacity and it's used up for now. Notes, checkpoints, search and revision still work. Try the tutor again later.",
  grading_failed: "Couldn't check your answer. Try again.",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  constructor(code: AppErrorCode, message?: string) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export function errorBody(code: AppErrorCode, message?: string) {
  return { error: { code, message: message ?? ERROR_MESSAGES[code] } };
}

/** Convert anything thrown in a route handler into a safe JSON response. */
export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(errorBody(error.code, error.message), { status: error.status });
  }
  // Redirects, notFound and prerender bail-outs are framework control flow: let Next handle them.
  unstable_rethrow(error);
  console.error("[api] unhandled error:", error instanceof Error ? `${error.name}: ${error.message}` : "unknown");
  return Response.json(errorBody("internal"), { status: 500 });
}

/** Read and validate a JSON body with a byte limit (Section 8: 2 KB default). */
export async function readJsonBody<S extends z.ZodType>(request: Request, schema: S, maxBytes = 2048): Promise<z.infer<S>> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new AppError("payload_too_large");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new AppError("payload_too_large");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AppError("bad_request");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new AppError("bad_request");
  return parsed.data;
}
