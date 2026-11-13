import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { clientEnv } from "@/env";
import type { Database } from "@/types/database";

/**
 * User-scoped Supabase client for Server Components, Server Actions and Route Handlers.
 * Uses the publishable key and the caller's session cookie, so RLS applies.
 * Create a new client per request; never share one across requests.
 */
export async function createClient() {
  // Supabase checks session expiry against Date.now(). With Partial Prefetching, a route that
  // reads cookies is also prerendered per session, and Next rejects clock reads there. Session
  // checks must run at request time anyway, so opt out of every prerender here.
  await connection();
  const cookieStore = await cookies();
  const env = clientEnv();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. src/proxy.ts refreshes
          // the session on every request, so this is safe to ignore.
        }
      },
    },
  });
}
