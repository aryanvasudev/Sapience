"use server";

import { z } from "zod";

import { OUTPUT_LANGUAGES } from "@/config/enums";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { YouTubeVideoId } from "@/types/contracts";

const SaveProgressSchema = z.object({
  videoId: YouTubeVideoId,
  language: z.enum(OUTPUT_LANGUAGES),
  seconds: z.number().min(0).max(24 * 3600),
  /** The furthest point actually played (not seeked to). The database never lets it go backwards. */
  furthest: z.number().min(0).max(24 * 3600).optional(),
});

/** Save the last playback position (Section 5.2). User-scoped client: RLS applies. */
export async function saveProgress(input: z.infer<typeof SaveProgressSchema>): Promise<void> {
  const parsed = SaveProgressSchema.safeParse(input);
  if (!parsed.success) return;
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = await createClient();
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      youtube_video_id: parsed.data.videoId,
      output_language: parsed.data.language,
      last_position_seconds: Math.floor(parsed.data.seconds),
      ...(parsed.data.furthest !== undefined ? { furthest_seconds: Math.floor(parsed.data.furthest) } : {}),
    },
    { onConflict: "user_id,youtube_video_id" },
  );
  if (error) console.error("[progress] save failed:", error.code);
}

const MarkOpenedSchema = SaveProgressSchema.omit({ seconds: true, furthest: true });

/**
 * Record that the student opened a lesson, so it shows in Continue learning and the Library
 * before anything has played. Never overwrites a saved position.
 */
export async function markLessonOpened(input: z.infer<typeof MarkOpenedSchema>): Promise<void> {
  const parsed = MarkOpenedSchema.safeParse(input);
  if (!parsed.success) return;
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = await createClient();
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      youtube_video_id: parsed.data.videoId,
      output_language: parsed.data.language,
      last_position_seconds: 0,
    },
    { onConflict: "user_id,youtube_video_id", ignoreDuplicates: true },
  );
  if (error) console.error("[progress] mark opened failed:", error.code);
}
