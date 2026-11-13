import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export { safeNextPath };

export type CurrentUser = {
  id: string;
  email: string | null;
  /** Guest (Supabase anonymous sign-in). Same RLS as a full account, tighter limits. */
  isAnonymous: boolean;
};

/**
 * The verified user for this request, or null. Uses getClaims(), which validates the JWT;
 * never trust getSession() alone on the server (Section 5.13). Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const { claims } = data;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" && claims.email.length > 0 ? claims.email : null,
    isAnonymous: claims.is_anonymous === true,
  };
});

/** For protected pages: returns the user or redirects to /login (with a safe `next`). */
export async function requireUser(nextPath = "/app"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  return user;
}
