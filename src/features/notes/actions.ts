"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { toPersonalNote, type PersonalNote } from "@/lib/notes/service";
import { createClient } from "@/lib/supabase/server";
import { YouTubeVideoId } from "@/types/contracts";

const MAX_NOTE_CHARS = 4000;
const MAX_NOTES_PER_LECTURE = 500;

const AddNoteSchema = z.object({
  videoId: YouTubeVideoId,
  kind: z.enum(["note", "bookmark"]),
  seconds: z.number().int().min(0).max(24 * 3600),
  content: z.string().trim().max(MAX_NOTE_CHARS).optional(),
});
const UpdateNoteSchema = z.object({ id: z.uuid(), content: z.string().trim().max(MAX_NOTE_CHARS) });
const DeleteNoteSchema = z.object({ id: z.uuid() });

export type NoteResult = { ok: true; note: PersonalNote } | { ok: false; message: string };

async function userOrRedirect() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function addNote(input: z.input<typeof AddNoteSchema>): Promise<NoteResult> {
  const user = await userOrRedirect();
  const parsed = AddNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Notes can be up to 4,000 characters." };
  const { videoId, kind, seconds, content } = parsed.data;
  if (kind === "note" && !content) return { ok: false, message: "Write something first." };

  const supabase = await createClient();
  const { count } = await supabase.from("notes").select("id", { count: "exact", head: true }).eq("youtube_video_id", videoId);
  if ((count ?? 0) >= MAX_NOTES_PER_LECTURE) return { ok: false, message: "You've reached 500 notes for this lecture." };

  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: user.id, youtube_video_id: videoId, kind, seconds, content: content || null })
    .select("id, kind, seconds, content, created_at")
    .single();
  if (error || !data) return { ok: false, message: "Couldn't save that. Try again." };
  return { ok: true, note: toPersonalNote(data) };
}

export async function updateNote(input: z.input<typeof UpdateNoteSchema>): Promise<NoteResult> {
  await userOrRedirect();
  const parsed = UpdateNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Notes can be up to 4,000 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .update({ content: parsed.data.content || null })
    .eq("id", parsed.data.id)
    .select("id, kind, seconds, content, created_at")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "Couldn't save that. Try again." };
  return { ok: true, note: toPersonalNote(data) };
}

export async function deleteNote(input: z.input<typeof DeleteNoteSchema>): Promise<{ ok: boolean }> {
  await userOrRedirect();
  const parsed = DeleteNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { error, count } = await supabase.from("notes").delete({ count: "exact" }).eq("id", parsed.data.id);
  return { ok: !error && (count ?? 0) > 0 };
}
