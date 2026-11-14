import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import { createServerClient } from "@supabase/ssr";
import { cacheLife } from "next/cache";
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
  // reads cookies is also prerendered per session, and Next rejects clock reads there, so outside
  // a private cache every read opts out of prerendering. Inside one (see `privateData`), clock
  // reads are allowed and `connection()` is not, so the read joins the per-session App Shell.
  if (!privateScope.getStore()) await connection();
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

const privateScope = new AsyncLocalStorage<true>();

/**
 * Runs a page's data loading inside a `"use cache: private"` function. Call it as the body of a
 * function that starts with the directive and `privateCacheLife()`, paired with the plain loader:
 *
 *   const loadLibrary = privateLoader(loadLibraryCached, loadLibraryFresh);
 *
 *   async function loadLibraryCached() {
 *     "use cache: private";
 *     privateCacheLife();
 *     return privateData(() => loadLibraryFresh());
 *   }
 *
 * The result is cached in the browser only (never on the server), per session, and becomes part
 * of the route's prefetched App Shell, so following a link renders the page with its data
 * instead of a skeleton. `<ClientCacheFreshness>` refreshes it after the student changes data.
 */
export function privateData<T>(load: () => Promise<T>): Promise<T> {
  return privateScope.run(true, load);
}

/** The lifetime for `privateData` functions: long enough (5 minutes) to be prefetched with the page. */
export function privateCacheLife() {
  cacheLife("minutes");
}

/**
 * Picks the `"use cache: private"` loader in production and the plain one in development. Next
 * doesn't prefetch in development, and its dev server answers a private cache with the previous
 * result while it refreshes, so right after a change the page would show old data. Development
 * reads fresh on every request instead, as it did before these caches.
 */
export function privateLoader<A extends unknown[], T>(
  cached: (...args: A) => Promise<T>,
  fresh: (...args: A) => Promise<T>,
): (...args: A) => Promise<T> {
  return process.env.NODE_ENV === "production" ? cached : fresh;
}
