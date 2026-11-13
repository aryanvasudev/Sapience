import "server-only";

/** `outline` job: whole video at low fps → chapters, then one `chapters` job per batch. */
import { serverEnv } from "@/env";
import { generateValidated } from "@/lib/ai/generate";
import { outlinePrompt } from "@/lib/ai/prompts/lesson";
import { models, youtubePart } from "@/lib/ai/provider";
import { OutlineSchema } from "@/lib/ai/schemas/lesson";
import { validateOutline } from "@/lib/ai/validate-lesson";
import { createAdminClient } from "@/lib/supabase/admin";

import { batchChapters } from "../batching";
import type { LessonContext, RunnerResult } from "./types";

export async function runOutline(lesson: LessonContext): Promise<RunnerResult> {
  const spec = models.video();
  if (!spec) throw new Error("No video model configured");
  const env = serverEnv();
  const prompt = outlinePrompt({ language: lesson.language, durationSeconds: lesson.durationSeconds });

  const { value: outline, usage } = await generateValidated(
    {
      spec,
      kind: "outline",
      schema: OutlineSchema,
      instructions: prompt.instructions,
      content: [youtubePart(lesson.youtubeVideoId, spec, undefined, env.LESSON_OUTLINE_FPS), { type: "text", text: prompt.text }],
      tuning: { mediaResolution: "MEDIA_RESOLUTION_LOW", thinkingLevel: "low" },
      forVideo: true,
      record: { lessonId: lesson.id },
    },
    (output) => validateOutline(output, lesson.durationSeconds),
  );

  const batches = batchChapters(
    outline.chapters.map((c, position) => ({ position, startSeconds: c.startSeconds, endSeconds: c.endSeconds })),
    env.LESSON_BATCH_MAX_MINUTES * 60,
  );
  const { error } = await createAdminClient().rpc("save_outline", {
    p_lesson_id: lesson.id,
    p_outline: outline,
    p_batches: batches,
  });
  if (error) throw new Error(`save_outline failed: ${error.code}`);
  return { usage, spec };
}
