import "server-only";

/**
 * `chapters` job: details for a batch of chapters with fixed boundaries.
 * - Video lessons: the video clipped to the batch (Gemini), or the whole video with the range
 *   stated in the prompt (OpenRouter, no clipping).
 * - Transcript lessons: the payload carries the code-built segments; a text model writes the rest.
 */
import { z } from "zod";

import { serverEnv } from "@/env";
import { generateStructuredWithFallback, generateValidated, InvalidLessonOutputError } from "@/lib/ai/generate";
import { chaptersPrompt, transcriptChaptersPrompt } from "@/lib/ai/prompts/lesson";
import { capabilities, models, youtubePart } from "@/lib/ai/provider";
import { ChapterBatchSchema, TranscriptChapterBatchSchema, type ChapterDetail } from "@/lib/ai/schemas/lesson";
import { validateChapterDetail, type ChapterBounds, type Validated } from "@/lib/ai/validate-lesson";
import { createAdminClient } from "@/lib/supabase/admin";
import { segmentsInRange } from "@/lib/transcript/segment";

import type { JobRow, LessonContext, RunnerResult } from "./types";
import { addUsage } from "./types";

const TranscriptSegmentSchema = z.object({
  startSeconds: z.number().int().min(0),
  endSeconds: z.number().int().min(1),
  speech: z.string(),
  board: z.null(),
});

export const ChaptersPayloadSchema = z.object({
  positions: z.array(z.number().int().min(0)).min(1),
  startSeconds: z.number().int().min(0),
  endSeconds: z.number().int().min(1),
  segments: z.array(TranscriptSegmentSchema).optional(),
});
export type ChaptersPayload = z.infer<typeof ChaptersPayloadSchema>;

type ChapterRef = { position: number; title: string; startSeconds: number; endSeconds: number };

/** Every requested position must come back exactly once, each valid for its own bounds. */
export function validateBatch<D extends { position: number } & Parameters<typeof validateChapterDetail>[0]>(
  details: D[],
  chapters: ChapterRef[],
  opts: { segmentsFromCode?: boolean } = {},
): Validated<D[]> {
  const problems: string[] = [];
  const wanted = new Map(chapters.map((c) => [c.position, c]));
  const seen = new Set<number>();
  const cleaned: D[] = [];

  for (const detail of details) {
    const chapter = wanted.get(detail.position);
    if (!chapter) {
      problems.push(`Position ${detail.position} was not requested. Only return positions ${[...wanted.keys()].join(", ")}.`);
      continue;
    }
    if (seen.has(detail.position)) {
      problems.push(`Position ${detail.position} is returned twice.`);
      continue;
    }
    seen.add(detail.position);
    const checked = validateChapterDetail(detail, chapter as ChapterBounds, opts);
    if (checked.ok) cleaned.push(checked.value);
    else problems.push(...checked.problems);
  }
  for (const position of wanted.keys()) {
    if (!seen.has(position)) problems.push(`Position ${position} is missing. Return details for every requested chapter.`);
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, value: cleaned };
}

async function loadChapters(lessonId: string, positions: number[]): Promise<ChapterRef[]> {
  const { data, error } = await createAdminClient()
    .from("lesson_chapters")
    .select("position, title, start_seconds, end_seconds")
    .eq("lesson_id", lessonId)
    .in("position", positions)
    .order("position");
  if (error || !data || data.length !== positions.length) throw new Error("chapters runner: chapters not found");
  return data.map((c) => ({ position: c.position, title: c.title, startSeconds: c.start_seconds, endSeconds: c.end_seconds }));
}

async function save(lessonId: string, details: ChapterDetail[]) {
  const { error } = await createAdminClient().rpc("save_chapter_batch", { p_lesson_id: lessonId, p_details: details });
  if (error) throw new Error(`save_chapter_batch failed: ${error.code}`);
}

export async function runChapters(lesson: LessonContext, job: JobRow): Promise<RunnerResult> {
  const payload = ChaptersPayloadSchema.parse(job.payload);
  const chapters = await loadChapters(lesson.id, payload.positions);
  const overview = lesson.overview ?? "";

  if (payload.segments) {
    const segments = payload.segments;
    const withSegments = chapters.map((c) => ({ ...c, segments: segmentsInRange(segments, c.startSeconds, c.endSeconds) }));
    const prompt = transcriptChaptersPrompt({ language: lesson.language, outline: { overview }, chapters: withSegments });
    const args = {
      kind: "transcript" as const,
      schema: TranscriptChapterBatchSchema,
      instructions: prompt.instructions,
      content: [{ type: "text" as const, text: prompt.text }],
      record: { lessonId: lesson.id },
    };
    const first = await generateStructuredWithFallback(models.main(), args);
    let checked = validateBatch(first.output.chapters, chapters, { segmentsFromCode: true });
    let usage = first.usage;
    let spec = first.spec;
    if (!checked.ok) {
      const repair = await generateStructuredWithFallback(models.main(), {
        ...args,
        content: [...args.content, { type: "text", text: `Your previous answer had these problems. Return the whole answer again with them fixed:\n${checked.problems.map((p) => `- ${p}`).join("\n")}` }],
      });
      usage = addUsage(usage, repair.usage);
      spec = repair.spec;
      checked = validateBatch(repair.output.chapters, chapters, { segmentsFromCode: true });
      if (!checked.ok) throw new InvalidLessonOutputError(checked.problems);
    }
    // Segments come from the transcript (code), never from the model.
    const details: ChapterDetail[] = checked.value.map((d) => ({
      ...d,
      segments: withSegments.find((w) => w.position === d.position)?.segments ?? [],
    }));
    await save(lesson.id, details);
    return { usage, spec };
  }

  const spec = models.video();
  if (!spec) throw new Error("No video model configured");
  const env = serverEnv();
  const clipping = capabilities().videoClipping;
  const range = { startSeconds: payload.startSeconds, endSeconds: payload.endSeconds };
  const prompt = chaptersPrompt({ language: lesson.language, overview, chapters, statedRange: clipping ? null : range });

  const { value, usage } = await generateValidated(
    {
      spec,
      kind: "chapters",
      schema: ChapterBatchSchema,
      instructions: prompt.instructions,
      content: [
        youtubePart(lesson.youtubeVideoId, spec, clipping ? range : undefined, env.LESSON_DETAIL_FPS),
        { type: "text", text: prompt.text },
      ],
      tuning: { mediaResolution: "MEDIA_RESOLUTION_LOW" },
      forVideo: true,
      record: { lessonId: lesson.id },
    },
    (output) => validateBatch(output.chapters, chapters),
  );
  await save(lesson.id, value);
  return { usage, spec };
}
