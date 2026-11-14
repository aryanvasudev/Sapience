/**
 * Classify AI SDK errors without leaking provider messages (Section 4.5.3, 5.4). Pure; uses
 * `isInstance` checks from `ai` so it works across bundles.
 */
import { APICallError, RetryError } from "ai";

import type { JobErrorCode } from "@/config/enums";

/** Thrown by `withFallback` when every model in the chain is rate-limited. Maps to `ai_busy`. */
export class AiBusyError extends Error {
  readonly retryAfterSeconds: number | null;
  constructor(retryAfterSeconds: number | null) {
    super("Every configured AI model is rate-limited right now.");
    this.name = "AiBusyError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Unwrap the SDK's RetryError to the last underlying error. */
export function rootError(error: unknown): unknown {
  let current = error;
  for (let i = 0; i < 5 && RetryError.isInstance(current); i++) current = current.lastError;
  return current;
}

function bodyText(error: unknown): string {
  if (!APICallError.isInstance(error)) return "";
  return typeof error.responseBody === "string" ? error.responseBody : "";
}

/**
 * "No capacity right now": a rate limit (429, RESOURCE_EXHAUSTED) or a temporarily overloaded
 * model (503 UNAVAILABLE / "high demand", 529 overloaded). Both mean "try the next model in the
 * chain, or wait": they fall back, requeue jobs with backoff, and show "waiting for capacity".
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof AiBusyError) return true;
  const root = rootError(error);
  if (APICallError.isInstance(root)) {
    if (root.statusCode === 429 || root.statusCode === 529) return true;
    const body = bodyText(root);
    if (/RESOURCE_EXHAUSTED|rate[ -]?limit|quota exceeded/i.test(body)) return true;
    if (root.statusCode === 503 && (/"UNAVAILABLE"/.test(body) || /overloaded|high demand/i.test(body || root.message))) return true;
  }
  return false;
}

/**
 * Seconds to wait, from a `retry-after` header or Google's `"retryDelay": "30s"` error detail.
 * Null when the provider didn't say.
 */
export function retryAfterSeconds(error: unknown): number | null {
  if (error instanceof AiBusyError) return error.retryAfterSeconds;
  const root = rootError(error);
  if (!APICallError.isInstance(root)) return null;
  const header = root.responseHeaders?.["retry-after"];
  if (header && /^\d+(\.\d+)?$/.test(header.trim())) return Math.ceil(Number(header));
  const delay = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(bodyText(root));
  return delay ? Math.ceil(Number(delay[1])) : null;
}

/** A safe code for `ai_calls.error_code`, `lessons.error_code` and `lesson_jobs.error_code`. */
export function jobErrorCode(error: unknown): JobErrorCode {
  if (isRateLimitError(error)) return "quota";
  const root = rootError(error);
  const name = root instanceof Error ? root.name : "";
  if (/Timeout|Abort/i.test(name)) return "model_timeout";
  if (/NoObjectGenerated|NoOutputGenerated|TypeValidation|JSONParse|InvalidOutput/i.test(name)) return "invalid_output";
  if (APICallError.isInstance(root)) {
    const body = bodyText(root);
    if (root.statusCode === 504 || /DEADLINE_EXCEEDED/i.test(body)) return "model_timeout";
    // A bad or missing API key is a configuration problem, not a problem with the video.
    if (/API[_ ]?key/i.test(body)) return "unknown";
    // Only call it a video problem when the provider says so about the video itself.
    if (
      root.statusCode !== undefined &&
      root.statusCode < 500 &&
      /\bvideo\b[^"]{0,80}\b(private|unavailable|not (?:available|accessible|found)|age[- ]restricted|restricted)\b/i.test(body)
    ) {
      return "video_unavailable";
    }
  }
  return "unknown";
}

/**
 * A log-safe description of a job error. Provider errors give only their name and HTTP status
 * (their bodies can echo the prompt); Sapience's own errors (missing model, failed save, chapters
 * not found) also give their message, which never contains lecture or student text.
 */
export function safeErrorSummary(error: unknown): string {
  const root = rootError(error);
  if (APICallError.isInstance(root)) return `${root.name} ${root.statusCode ?? "no-status"}`;
  if (!(root instanceof Error)) return "unknown";
  if (root.name.startsWith("AI_") || root.name === "InvalidOutputError") return root.name;
  return `${root.name}: ${root.message.slice(0, 160)}`;
}
