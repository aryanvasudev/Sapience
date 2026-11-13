import "server-only";

/** Admin usage page data (P1, `/app/admin/usage`). Only for emails in ADMIN_EMAILS. */
import { serverEnv } from "@/env";
import type { CurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

import { summarizeCalls, type CallRow } from "./summarize";

export const USAGE_WINDOW_DAYS = 30;
const MAX_ROWS = 20_000;

export function isAdmin(user: CurrentUser): boolean {
  return !user.isAnonymous && user.email !== null && serverEnv().ADMIN_EMAILS.includes(user.email.toLowerCase());
}

export async function usageReport(now: number = Date.now()) {
  const since = new Date(now - USAGE_WINDOW_DAYS * 86_400_000).toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_calls")
    .select("kind, provider, model, lesson_id, byok, ok, fallback_from, input_tokens, output_tokens, duration_ms")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (error) return null;
  const rows: CallRow[] = data;
  const summary = summarizeCalls(rows);

  const lessonIds = summary.byLesson.slice(0, 50).map((b) => b.key);
  const lessons = new Map<string, { title: string; language: string; source: string; durationSeconds: number }>();
  if (lessonIds.length) {
    const { data: rowsL } = await admin
      .from("lessons")
      .select("id, output_language, source, videos(title, duration_seconds)")
      .in("id", lessonIds);
    for (const l of rowsL ?? []) {
      lessons.set(l.id, {
        title: l.videos?.title ?? "Unknown video",
        language: l.output_language,
        source: l.source,
        durationSeconds: l.videos?.duration_seconds ?? 0,
      });
    }
  }
  return { ...summary, lessons, truncated: rows.length === MAX_ROWS, since };
}
