/**
 * Lesson-map schemas (Section 5.3). Every model output is validated against these with Zod before
 * anything is written. `nullable` (not `optional`) is deliberate: it is friendlier to structured
 * output, which must always emit every key.
 */
import { z } from "zod";

export const OutlineChapterSchema = z.object({
  title: z.string().min(3).max(120),
  startSeconds: z.number().int().min(0),
  endSeconds: z.number().int().min(1),
});
export type OutlineChapter = z.infer<typeof OutlineChapterSchema>;

export const OutlineSchema = z.object({
  spokenLanguage: z.string().max(40), // "en", "hi", "hi-en (mixed)"
  overview: z.string().min(10).max(800),
  chapters: z.array(OutlineChapterSchema).min(1).max(40),
});
export type Outline = z.infer<typeof OutlineSchema>;

export const CheckpointSchema = z.object({
  concept: z.string().min(3).max(120),
  question: z.string().min(10).max(500),
  options: z.array(z.string().min(1).max(200)),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(10).max(1200),
  misconception: z.string().max(300).nullable(),
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;

/** One entry of the lecture index. */
export const LessonSegmentSchema = z.object({
  startSeconds: z.number().int().min(0),
  endSeconds: z.number().int().min(1),
  speech: z.string().min(1).max(1500), // condensed, faithful; in the spoken language
  board: z.string().max(600).nullable(), // what is written/shown; LaTeX for maths
});
export type LessonSegment = z.infer<typeof LessonSegmentSchema>;

export const KeyMomentInputSchema = z.object({
  seconds: z.number().int().min(0),
  label: z.string().min(3).max(120),
});

export const ChapterDetailSchema = z.object({
  position: z.number().int().min(0),
  summary: z.string().min(10).max(600),
  notesMarkdown: z.string().min(10).max(4000),
  keyTerms: z.array(z.string().max(80)),
  formulas: z.array(z.string().max(300)),
  keyMoments: z.array(KeyMomentInputSchema),
  checkpoint: CheckpointSchema.nullable(),
  segments: z.array(LessonSegmentSchema),
});
export type ChapterDetail = z.infer<typeof ChapterDetailSchema>;

export const ChapterBatchSchema = z.object({ chapters: z.array(ChapterDetailSchema).min(1).max(12) });
export type ChapterBatch = z.infer<typeof ChapterBatchSchema>;

/** Single pass for short videos: outline and details in one response. */
export const FullLessonSchema = OutlineSchema.extend({
  chapters: z
    .array(OutlineChapterSchema.extend(ChapterDetailSchema.omit({ position: true }).shape))
    .min(1)
    .max(12),
});
export type FullLesson = z.infer<typeof FullLessonSchema>;
export type FullLessonChapter = FullLesson["chapters"][number];

/**
 * Transcript path: segments are built in code from the pasted transcript, so the model returns
 * everything in a chapter except the segments.
 */
export const TranscriptChapterDetailSchema = ChapterDetailSchema.omit({ segments: true });
export const TranscriptChapterBatchSchema = z.object({
  chapters: z.array(TranscriptChapterDetailSchema).min(1).max(12),
});
export type TranscriptChapterBatch = z.infer<typeof TranscriptChapterBatchSchema>;
