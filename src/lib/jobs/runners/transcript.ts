import "server-only";

/**
 * `transcript` job (Section 5.8): outline from the pasted transcript with a text model, then one
 * `chapters` job per batch carrying that batch's code-built segments. No YouTube-video quota.
 */
import { z } from "zod";

import { serverEnv } from "@/env";
import { generateStructuredWithFallback, InvalidLessonOutputError } from "@/lib/ai/generate";
import { transcriptOutlinePrompt } from "@/lib/ai/prompts/lesson";
import { models } from "@/lib/ai/provider";
import { OutlineSchema } from "@/lib/ai/schemas/lesson";
import { validateOutline } from "@/lib/ai/validate-lesson";
import { createAdminClient } from "@/lib/supabase/admin";
import { alignChaptersToSegments, segmentsInRange, type TranscriptSegment } from "@/lib/transcript/segment";

import { batchChapters } from "../batching";
import type { JobRow, LessonContext, RunnerResult } from "./types";
import { addUsage } from "./types";

export const TranscriptPayloadSchema = z.object({
  segments: z
    .array(
      z.object({
        startSeconds: z.number().int().min(0),
        endSeconds: z.number().int().min(1),
        speech: z.string(),
        board: z.null(),
      }),
    )
    .min(1),
});

export async function runTranscript(lesson: LessonContext, job: JobRow): Promise<RunnerResult> {
  const { segments } = TranscriptPayloadSchema.parse(job.payload) as { segments: TranscriptSegment[] };
  const prompt = transcriptOutlinePrompt({ language: lesson.language, durationSeconds: lesson.durationSeconds, segments });
  const args = {
    kind: "transcript" as const,
    schema: OutlineSchema,
    instructions: prompt.instructions,
    content: [{ type: "text" as const, text: prompt.text }],
    record: { lessonId: lesson.id },
  };

  const first = await generateStructuredWithFallback(models.main(), args);
  let checked = validateOutline(first.output, lesson.durationSeconds);
  let usage = first.usage;
  let spec = first.spec;
  if (!checked.ok) {
    const repair = await generateStructuredWithFallback(models.main(), {
      ...args,
      content: [...args.content, { type: "text", text: `Your previous answer had these problems. Return the whole answer again with them fixed:\n${checked.problems.map((p) => `- ${p}`).join("\n")}` }],
    });
    usage = addUsage(usage, repair.usage);
    spec = repair.spec;
    checked = validateOutline(repair.output, lesson.durationSeconds);
    if (!checked.ok) throw new InvalidLessonOutputError(checked.problems);
  }

  // Put chapter boundaries on segment starts so every segment belongs to one chapter.
  const outline = {
    ...checked.value,
    chapters: alignChaptersToSegments(checked.value.chapters, segments, lesson.durationSeconds),
  };
  const batches = batchChapters(
    outline.chapters.map((c, position) => ({ position, startSeconds: c.startSeconds, endSeconds: c.endSeconds })),
    serverEnv().LESSON_BATCH_MAX_MINUTES * 60,
  ).map((b) => ({ ...b, segments: segmentsInRange(segments, b.startSeconds, b.endSeconds) }));

  const { error } = await createAdminClient().rpc("save_outline", {
    p_lesson_id: lesson.id,
    p_outline: outline,
    p_batches: batches,
  });
  if (error) throw new Error(`save_outline failed: ${error.code}`);
  return { usage, spec };
}
