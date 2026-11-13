import "server-only";

/** Personal notes and bookmarks at timestamps (Section 3.2, P1). User-scoped client: RLS applies. */
import { createClient } from "@/lib/supabase/server";

export type PersonalNote = {
  id: string;
  kind: "note" | "bookmark";
  seconds: number | null;
  content: string | null;
  createdAt: string;
};

type NoteRow = { id: string; kind: string; seconds: number | null; content: string | null; created_at: string };

export const toPersonalNote = (row: NoteRow): PersonalNote => ({
  id: row.id,
  kind: row.kind === "bookmark" ? "bookmark" : "note",
  seconds: row.seconds,
  content: row.content,
  createdAt: row.created_at,
});

/** The student's notes for one lecture, in lecture order. */
export async function listNotes(videoId: string): Promise<PersonalNote[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("id, kind, seconds, content, created_at")
    .eq("youtube_video_id", videoId)
    .order("seconds", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(500);
  return (data ?? []).map(toPersonalNote);
}
