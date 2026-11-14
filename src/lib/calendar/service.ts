import "server-only";

/** The study calendar: sessions the student planned. User-scoped client: RLS applies. */
import { createClient } from "@/lib/supabase/server";

export type StudyEvent = {
  id: string;
  title: string;
  notes: string | null;
  startsAt: string;
  endsAt: string;
  youtubeVideoId: string | null;
  seconds: number | null;
};

export type StudyEventRow = {
  id: string;
  title: string;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  youtube_video_id: string | null;
  seconds: number | null;
};

export const STUDY_EVENT_COLUMNS = "id, title, notes, starts_at, ends_at, youtube_video_id, seconds";

export const toStudyEvent = (row: StudyEventRow): StudyEvent => ({
  id: row.id,
  title: row.title,
  notes: row.notes,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  youtubeVideoId: row.youtube_video_id,
  seconds: row.seconds,
});

/** The student's sessions that overlap [from, to). */
export async function listStudyEvents(from: Date, to: Date): Promise<StudyEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("study_events")
    .select(STUDY_EVENT_COLUMNS)
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString())
    .order("starts_at")
    .limit(500);
  return (data ?? []).map(toStudyEvent);
}

/** A study room goal with a due date, from a room the student belongs to (RLS). */
export type RoomDeadline = { id: string; roomId: string; roomName: string; title: string; dueAt: string };

export async function listRoomDeadlines(from: Date, to: Date): Promise<RoomDeadline[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("room_goals")
    .select("id, room_id, title, due_at, study_rooms(name)")
    .not("due_at", "is", null)
    .gte("due_at", from.toISOString())
    .lt("due_at", to.toISOString())
    .order("due_at")
    .limit(500);
  return (data ?? []).flatMap((g) => {
    if (!g.due_at) return [];
    const room = Array.isArray(g.study_rooms) ? g.study_rooms[0] : g.study_rooms;
    return [{ id: g.id, roomId: g.room_id, roomName: room?.name ?? "Study room", title: g.title, dueAt: g.due_at }];
  });
}

/** When each saved concept is next due, up to `until` (already-due ones included). */
export async function listRevisionDueDates(until: Date): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("revision_items")
    .select("due_at")
    .lte("due_at", until.toISOString())
    .order("due_at")
    .limit(5000);
  return (data ?? []).map((r) => r.due_at);
}

const DAY_MS = 86_400_000;

/** Everything the calendar page shows: about two months back to a year ahead. */
export async function loadCalendarData(now = new Date()) {
  const from = new Date(now.getTime() - 62 * DAY_MS);
  const until = new Date(now.getTime() + 366 * DAY_MS);
  const [events, deadlines, revisionDue] = await Promise.all([
    listStudyEvents(from, until),
    listRoomDeadlines(from, until),
    listRevisionDueDates(new Date(now.getTime() + 62 * DAY_MS)),
  ]);
  return { events, deadlines, revisionDue };
}
