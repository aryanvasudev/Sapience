"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { feedUrls, newFeedToken } from "@/lib/calendar/feed";
import { createClient } from "@/lib/supabase/server";

export type FeedResult = { ok: true; url: string; webcalUrl: string } | { ok: false; message: string };

const FAILED: FeedResult = { ok: false, message: "Couldn't make your calendar link. Try again." };

async function userOrRedirect() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/calendar");
  return user;
}

/** The student's private subscription URL, created the first time it's asked for. */
export async function getOrCreateFeed(): Promise<FeedResult> {
  const user = await userOrRedirect();
  const supabase = await createClient();
  const { data: existing } = await supabase.from("calendar_feeds").select("token").eq("user_id", user.id).maybeSingle();
  if (existing) return { ok: true, ...feedUrls(existing.token) };

  const token = newFeedToken();
  const { error } = await supabase.from("calendar_feeds").insert({ user_id: user.id, token });
  if (error) {
    // Two tabs asked at once: use the one that won.
    const { data: winner } = await supabase.from("calendar_feeds").select("token").eq("user_id", user.id).maybeSingle();
    return winner ? { ok: true, ...feedUrls(winner.token) } : FAILED;
  }
  return { ok: true, ...feedUrls(token) };
}

/** Replace the token: calendars subscribed to the old URL stop updating. */
export async function resetFeed(): Promise<FeedResult> {
  const user = await userOrRedirect();
  const supabase = await createClient();
  const token = newFeedToken();
  const { error } = await supabase.from("calendar_feeds").upsert({ user_id: user.id, token }, { onConflict: "user_id" });
  if (error) return FAILED;
  return { ok: true, ...feedUrls(token) };
}
