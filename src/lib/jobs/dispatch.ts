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
