import "server-only";

import { createClient } from "@supabase/supabase-js";

import { clientEnv, serverEnv } from "@/env";
import type { Database } from "@/types/database";

/**
 * Secret-key Supabase client. BYPASSES ROW LEVEL SECURITY.
 *
 * Only for server-only tables (lessons, lesson_chapters, lesson_jobs, questions, ai_calls,
 * user_api_keys), grading, quota functions and admin auth calls. Never pass a user-supplied
 * user ID to it: take the ID from the verified session (`getCurrentUser()`).
 */
export function createAdminClient() {
  return createClient<Database>(clientEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
