import "server-only";

/**
 * The student's study plan as an iCalendar feed, for Google Calendar (or Apple, Outlook) to
 * subscribe to. The feed URL carries a secret token instead of a session, so this module reads
 * with the secret key and scopes every query to the token's owner.
 */
import { randomBytes } from "node:crypto";

import { clientEnv } from "@/env";
import { createAdminClient } from "@/lib/supabase/admin";

import { buildIcsCalendar, dayInTimeZone, type IcsEvent } from "./ics";
import { lessonPath } from "./links";

/** Days are counted in India time, like daily limits (consume_quota). */
export const FEED_TIME_ZONE = "Asia/Kolkata";
const PAST_DAYS = 60;
const FUTURE_DAYS = 365;
const REVISION_DAYS = 30;
const DAY_MS = 86_400_000;

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{32,64}$/;

export const newFeedToken = (): string => randomBytes(32).toString("base64url");

export function feedUrls(token: string): { url: string; webcalUrl: string } {
  const appUrl = clientEnv().NEXT_PUBLIC_APP_URL.replace("sapience.vercel.app", "sapience-01.vercel.app");
  const url = new URL(`/api/calendar/feed/${token}.ics`, appUrl).toString();
  return { url, webcalUrl: url.replace(/^https?:/, "webcal:") };
}

/** The iCalendar text for a feed token, or null if the token is unknown. */
export async function buildFeed(token: string, now = new Date()): Promise<string | null> {
  if (!TOKEN_FORMAT.test(token)) return null;
  const admin = createAdminClient();
  const { data: feed } = await admin.from("calendar_feeds").select("user_id").eq("token", token).maybeSingle();
  if (!feed) return null;
  const userId = feed.user_id;
  const appUrl = clientEnv().NEXT_PUBLIC_APP_URL.replace("sapience.vercel.app", "sapience-01.vercel.app");
  const absolute = (path: string) => new URL(path, appUrl).toString();

  const from = new Date(now.getTime() - PAST_DAYS * DAY_MS).toISOString();
  const until = new Date(now.getTime() + FUTURE_DAYS * DAY_MS).toISOString();
  const revisionUntil = new Date(now.getTime() + REVISION_DAYS * DAY_MS).toISOString();

  const [sessions, memberships, revision] = await Promise.all([
    admin
      .from("study_events")
      .select("id, title, notes, starts_at, ends_at, youtube_video_id, seconds")
      .eq("user_id", userId)
      .gte("ends_at", from)
      .lte("starts_at", until)
      .order("starts_at")
      .limit(1000),
    admin.from("room_members").select("room_id").eq("user_id", userId).limit(200),
    admin.from("revision_items").select("due_at").eq("user_id", userId).lte("due_at", revisionUntil).limit(5000),
  ]);

  const roomIds = (memberships.data ?? []).map((m) => m.room_id);
  const goals = roomIds.length
    ? await admin
        .from("room_goals")
        .select("id, room_id, title, due_at, study_rooms(name)")
        .in("room_id", roomIds)
        .not("due_at", "is", null)
        .gte("due_at", from)
        .lte("due_at", until)
        .limit(1000)
    : { data: [] };

  const events: IcsEvent[] = [];

  for (const s of sessions.data ?? []) {
    events.push({
      uid: `${s.id}@sapience`,
      title: s.title,
      start: s.starts_at,
      end: s.ends_at,
      description: s.notes,
      url: s.youtube_video_id ? absolute(lessonPath(s.youtube_video_id, s.seconds)) : null,
    });
  }

  for (const g of goals.data ?? []) {
    if (!g.due_at) continue;
    const room = Array.isArray(g.study_rooms) ? g.study_rooms[0] : g.study_rooms;
    events.push({
      uid: `goal-${g.id}@sapience`,
      allDay: true,
      date: dayInTimeZone(g.due_at, FEED_TIME_ZONE),
      title: room?.name ? `${room.name}: ${g.title}` : g.title,
      description: "Study room goal due.",
      url: absolute(`/app/rooms/${g.room_id}`),
    });
  }

  // Concepts already due count toward today.
  const today = dayInTimeZone(now, FEED_TIME_ZONE);
  const perDay = new Map<string, number>();
  for (const r of revision.data ?? []) {
    const day = new Date(r.due_at) <= now ? today : dayInTimeZone(r.due_at, FEED_TIME_ZONE);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  for (const [day, count] of [...perDay].sort(([a], [b]) => a.localeCompare(b))) {
    events.push({
      uid: `revision-${day}@sapience`,
      allDay: true,
      date: day,
      title: `Revision: ${count} ${count === 1 ? "concept" : "concepts"} due`,
      description: "A few minutes of review keeps them from slipping.",
      url: absolute("/app/revision"),
    });
  }

  return buildIcsCalendar({
    name: "Sapience study plan",
    description: "Study sessions, study room deadlines and revision from Sapience.",
    events,
    now,
  });
}
