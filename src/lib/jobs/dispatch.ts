import "server-only";

/**
 * Job dispatch (Section 5.4): each job runs in its own invocation of the internal run route, so
 * it gets its own 300 s budget. Dispatch only waits for the 202.
 */
import { clientEnv, serverEnv } from "@/env";
import { createAdminClient } from "@/lib/supabase/admin";

export function internalBaseUrl(): string {
  const env = serverEnv();
  if (env.APP_INTERNAL_URL) return env.APP_INTERNAL_URL.replace(/\/$/, "");
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return clientEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

export async function dispatchJob(jobId: string): Promise<boolean> {
  const env = serverEnv();
  const headers: Record<string, string> = { authorization: `Bearer ${env.INTERNAL_JOB_SECRET}` };
  if (env.VERCEL_AUTOMATION_BYPASS_SECRET) headers["x-vercel-protection-bypass"] = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  try {
    const response = await fetch(`${internalBaseUrl()}/api/internal/jobs/${jobId}/run`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    return response.status === 202 || response.status === 200;
  } catch (error) {
    console.error("[jobs] dispatch failed:", error instanceof Error ? error.name : "unknown");
    return false;
  }
}

/**
 * Dispatch due jobs while fewer than AI_MAX_CONCURRENT_JOBS are running (the claim enforces the
 * cap again, atomically). Called after a lesson is created, after every job, and by the watchdog.
 */
export async function dispatchNext(lessonId?: string): Promise<number> {
  const { data, error } = await createAdminClient().rpc("dispatchable_jobs", {
    p_max_running: serverEnv().AI_MAX_CONCURRENT_JOBS,
    ...(lessonId ? { p_lesson_id: lessonId } : {}),
  });
  if (error || !data) {
    if (error) console.error("[jobs] dispatchable_jobs failed:", error.code);
    return 0;
  }
  const ids = (data as unknown as string[]).filter((id) => typeof id === "string");
  const results = await Promise.all(ids.map((id) => dispatchJob(id)));
  return results.filter(Boolean).length;
}

/** Mirrors `lesson_jobs` in SQL: a claim needs attempts < 3, and a lock older than 6 minutes is stale. */
const MAX_ATTEMPTS = 3;
const STALE_LOCK_MS = 6 * 60_000;

/**
 * A job whose run died without reporting back (the function was killed, the server restarted)
 * stays `running`. With attempts left, `dispatchable_jobs` re-dispatches it once the lock is stale;
 * on its last attempt nothing ever would, and the lesson would show "building" forever. Fail those,
 * so the lesson settles and the student gets a retry. Called by the watchdog.
 */
export async function failAbandonedJobs(lessonId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lesson_jobs")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("status", "running")
    .gte("attempts", MAX_ATTEMPTS)
    .lt("locked_at", new Date(Date.now() - STALE_LOCK_MS).toISOString());
  if (error) {
    console.error("[jobs] abandoned-job check failed:", error.code);
    return;
  }
  await Promise.all(
    (data ?? []).map((job) =>
      admin.rpc("fail_lesson_job", { p_job_id: job.id, p_error_code: "model_timeout", p_retry_delay_seconds: 0 }),
    ),
  );
}
