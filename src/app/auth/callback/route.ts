import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth (Google) and email-confirmation landing route. Exchanges the one-time `code` for a
 * session cookie, then sends the user on to a safe, same-origin `next` path.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  const failed = new URL("/login", origin);
  failed.searchParams.set("error", searchParams.get("error_code") === "identity_already_exists" ? "identity_exists" : "callback");
  return NextResponse.redirect(failed);
}
