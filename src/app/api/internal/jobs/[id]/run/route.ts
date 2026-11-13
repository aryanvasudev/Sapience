import { timingSafeEqual } from "node:crypto";

import { after } from "next/server";
import { z } from "zod";

import { serverEnv } from "@/env";
import { runClaimedJob } from "@/lib/jobs/run-job";
import { createAdminClient } from "@/lib/supabase/admin";

/** Each job gets its own invocation and its own 300 s budget (Section 5.4). */
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${serverEnv().INTERNAL_JOB_SECRET}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** POST /api/internal/jobs/[id]/run: secret-protected. 202 = claimed and running, 200 = nothing to do. */
export async function POST(request: Request, ctx: RouteContext<"/api/internal/jobs/[id]/run">) {
  if (!authorized(request)) return new Response(null, { status: 401 });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 400 });

  const { data, error } = await createAdminClient().rpc("claim_lesson_job", {
    p_job_id: id,
    p_max_running: serverEnv().AI_MAX_CONCURRENT_JOBS,
  });
  if (error) {
    console.error("[jobs] claim failed:", error.code);
    return new Response(null, { status: 500 });
  }
  const job = data?.[0];
  if (!job) return new Response(null, { status: 200 });

  after(() => runClaimedJob(job));
  return new Response(null, { status: 202 });
}
