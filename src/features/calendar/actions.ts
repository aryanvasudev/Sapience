"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { STUDY_EVENT_COLUMNS, toStudyEvent, type StudyEvent } from "@/lib/calendar/service";
import { createClient } from "@/lib/supabase/server";
import { YouTubeVideoId } from "@/types/contracts";

const MAX_EVENTS = 1000;

const CreateEventSchema = z.object({
  title: z.string().trim().min(1, "Give the session a name.").max(120, "Keep the name under 120 characters."),
  notes: z.string().trim().max(2000).optional(),
  startsAt: z.iso.datetime({ offset: true }),
  durationMinutes: z.number().int().min(5).max(12 * 60),
  youtubeVideoId: YouTubeVideoId.optional(),
  seconds: z.number().int().min(0).max(24 * 3600).optional(),
});

export type CreateStudyEventInput = z.input<typeof CreateEventSchema>;
export type StudyEventResult = { ok: true; event: StudyEvent } | { ok: false; message: string };

async function userOrRedirect() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/calendar");
  return user;
}

/** Plan a study session (also used by the lesson's "remind me to finish this"). */
export async function createStudyEvent(input: CreateStudyEventInput): Promise<StudyEventResult> {
  const user = await userOrRedirect();
  const parsed = CreateEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the session details." };
  const { title, notes, startsAt, durationMinutes, youtubeVideoId, seconds } = parsed.data;
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const supabase = await createClient();
  const { count } = await supabase.from("study_events").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_EVENTS) return { ok: false, message: "Your calendar is full. Delete some old sessions first." };

  const { data, error } = await supabase
    .from("study_events")
    .insert({
      user_id: user.id,
      title,
      notes: notes || null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      youtube_video_id: youtubeVideoId ?? null,
      seconds: youtubeVideoId ? (seconds ?? null) : null,
    })
    .select(STUDY_EVENT_COLUMNS)
    .single();
  if (error || !data) return { ok: false, message: "Couldn't add that to your calendar. Try again." };
  return { ok: true, event: toStudyEvent(data) };
}

export async function deleteStudyEvent(input: { id: string }): Promise<{ ok: boolean }> {
  await userOrRedirect();
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { error, count } = await supabase.from("study_events").delete({ count: "exact" }).eq("id", parsed.data.id);
  return { ok: !error && (count ?? 0) > 0 };
}
