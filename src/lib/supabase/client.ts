import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/env-client";
import type { Database } from "@/types/database";

/** Browser Supabase client (publishable key, RLS applies). Use in Client Components only. */
export function createClient() {
  const env = clientEnv();
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
