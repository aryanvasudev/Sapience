import "server-only";

/** `full` job: whole short video (≤ LESSON_SINGLE_PASS_MAX_MINUTES) in one pass → FullLesson. */
import { serverEnv } from "@/env";
import { generateValidatedOnVideoChain } from "@/lib/ai/generate";
import { fullLessonPrompt } from "@/lib/ai/prompts/lesson";
import { models, youtubePart } from "@/lib/ai/provider";
import { FullLessonSchema, type FullLesson } from "@/lib/ai/schemas/lesson";
import { validateChapterDetail, validateOutline, type Validated } from "@/lib/ai/validate-lesson";
import { createAdminClient } from "@/lib/supabase/admin";

import type { LessonContext, RunnerResult } from "./types";

export function validateFullLesson(lesson: FullLesson, durationSeconds: number): Validated<FullLesson> {
  const outline = validateOutline(lesson, durationSeconds, { mergeShort: false });
  if (!outline.ok) return outline;
  const problems: string[] = [];
  const chapters = outline.value.chapters.map((chapter, position) => {
    const checked = validateChapterDetail({ ...chapter, position }, chapter);
    if (!checked.ok) {
      problems.push(...checked.problems);
      return chapter;
    }
    const { position: _drop, ...rest } = checked.value;
    void _drop;
    return { ...rest, title: chapter.title, startSeconds: chapter.startSeconds, endSeconds: chapter.endSeconds };
  });
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value: { ...outline.value, chapters } };
}

export async function runFull(lesson: LessonContext): Promise<RunnerResult> {
  const chain = models.videoChain();
  if (chain.length === 0) throw new Error("No video model configured");
  const env = serverEnv();
  const prompt = fullLessonPrompt({ language: lesson.language, durationSeconds: lesson.durationSeconds });

  const { value, usage, spec } = await generateValidatedOnVideoChain(
    chain,
    {
      kind: "full",
      schema: FullLessonSchema,
      instructions: prompt.instructions,
      content: (spec) => [youtubePart(lesson.youtubeVideoId, spec, undefined, env.LESSON_DETAIL_FPS), { type: "text", text: prompt.text }],
      tuning: { mediaResolution: "MEDIA_RESOLUTION_LOW" },
      forVideo: true,
      record: { lessonId: lesson.id },
    },
    (output) => validateFullLesson(output, lesson.durationSeconds),
  );

  const { error } = await createAdminClient().rpc("save_full_lesson", { p_lesson_id: lesson.id, p_lesson: value });
  if (error) throw new Error(`save_full_lesson failed: ${error.code}`);
  return { usage, spec };
}
