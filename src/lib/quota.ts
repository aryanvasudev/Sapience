import "server-only";

/**
 * Daily limits (Section 4.5.3, 5.13, 8). Counters live in `usage_daily` and are changed only by
 * the `consume_quota` function, which only the secret-key client may call.
 */
import { serverEnv } from "@/env";
import type { CurrentUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

async function consume(userId: string, kind: "lesson" | "ai", limit: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("consume_quota", {
    p_user_id: userId,
    p_kind: kind,
    p_limit: limit,
  });
  if (error) {
    console.error("[quota] consume_quota failed:", error.code);
    throw new AppError("internal");
  }
  return data === true;
}

/** Count one new lesson against the user's and the app's daily limits, or throw the right error. */
export async function consumeLessonQuota(user: CurrentUser): Promise<void> {
  const env = serverEnv();
  const { data: today, error } = await createAdminClient().rpc("global_lessons_today");
  if (error) throw new AppError("internal");
  if ((today ?? 0) >= env.GLOBAL_LESSONS_DAILY_LIMIT) throw new AppError("global_lesson_limit");

  const limit = user.isAnonymous ? env.LESSONS_DAILY_LIMIT_GUEST : env.LESSONS_DAILY_LIMIT_PER_USER;
  if (!(await consume(user.id, "lesson", limit))) {
    if (user.isAnonymous) throw new AppError("guest_lesson_limit");
    throw new AppError(
      "lesson_daily_limit",
      `You've built ${limit} new ${limit === 1 ? "lesson" : "lessons"} today. Lessons that already exist still open.`,
    );
  }
}

/** Count one AI request (tutor, search, check question) against the user's daily limit. */
export async function consumeAiQuota(user: CurrentUser): Promise<void> {
  const env = serverEnv();
  const limit = user.isAnonymous ? env.AI_DAILY_LIMIT_GUEST : env.AI_DAILY_LIMIT_PER_USER;
  if (!(await consume(user.id, "ai", limit))) throw new AppError("ai_daily_limit");
}
