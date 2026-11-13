/**
 * Shared TypeScript contracts between server and client (Section 8.1).
 *
 * Schemas are Zod so the same definitions validate requests at runtime and give static types.
 * "Public" shapes are what may leave the server: they never contain a question's correct answer,
 * explanation or misconception before the student has attempted it.
 */
import { z } from "zod";

import {
  APP_ERROR_CODES,
  CHAPTER_STATUSES,
  CONCEPT_SOURCES,
  LEARNER_LEVELS,
  LESSON_SOURCES,
  LESSON_STATUSES,
  MATH_DETAIL_LEVELS,
  OUTPUT_LANGUAGES,
  RECALL_RATINGS,
  REVISION_STATES,
  TONES,
  TUTOR_MODES,
  TUTOR_QUICK_ACTIONS,
  TUTOR_STYLES,
} from "@/config/enums";

export type {
  ChapterStatus,
  LessonStatus,
  OutputLanguage,
  RecallRating,
} from "@/config/enums";

export const YouTubeVideoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Invalid YouTube video ID");
export const OutputLanguageSchema = z.enum(OUTPUT_LANGUAGES);

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(APP_ERROR_CODES),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ---------------------------------------------------------------------------
// Preferences (profiles.preferences jsonb)
// ---------------------------------------------------------------------------

export const PreferencesSchema = z.object({
  language: z.enum(OUTPUT_LANGUAGES).default("en"),
  level: z.enum(LEARNER_LEVELS).default("college"),
  mathDetail: z.enum(MATH_DETAIL_LEVELS).default("standard"),
  defaultStyle: z.enum(TUTOR_STYLES).default("intuition"),
  tone: z.enum(TONES).default("direct"),
  pauseForCheckpoints: z.boolean().default(true),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

/** Parse stored preferences leniently: unknown or invalid fields fall back to defaults. */
export function parsePreferences(value: unknown): Preferences {
  const input = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const defaults = PreferencesSchema.parse({});
  const result: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof Preferences)[]) {
    const field = PreferencesSchema.shape[key].safeParse(input[key]);
    if (field.success) result[key] = field.data;
  }
  return PreferencesSchema.parse(result);
}

// ---------------------------------------------------------------------------
// Lesson (public)
// ---------------------------------------------------------------------------

export const KeyMomentSchema = z.object({
  id: z.string(),
  seconds: z.number().int().min(0),
  label: z.string(),
});
export type KeyMoment = z.infer<typeof KeyMomentSchema>;

/** One entry of the lecture index. IDs are `c{chapter}s{segment}`. Contains no answers. */
export const SegmentSchema = z.object({
  id: z.string(),
  startSeconds: z.number().int().min(0),
  endSeconds: z.number().int().min(1),
  speech: z.string(),
  board: z.string().nullable(),
});
export type Segment = z.infer<typeof SegmentSchema>;

export const QuestionPublicSchema = z.object({
  id: z.uuid(),
  concept: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).length(4),
  atSeconds: z.number().int().min(0).nullable(),
});
export type QuestionPublic = z.infer<typeof QuestionPublicSchema>;

export const ChapterPublicSchema = z.object({
  position: z.number().int().min(0),
  status: z.enum(CHAPTER_STATUSES),
  title: z.string(),
  startSeconds: z.number().int().min(0),
  endSeconds: z.number().int().min(1),
  summary: z.string().nullable(),
  notesMarkdown: z.string().nullable(),
  keyTerms: z.array(z.string()),
  formulas: z.array(z.string()),
  keyMoments: z.array(KeyMomentSchema),
  segments: z.array(SegmentSchema),
  checkpoint: QuestionPublicSchema.nullable(),
});
export type ChapterPublic = z.infer<typeof ChapterPublicSchema>;

export const LessonPublicSchema = z.object({
  youtubeVideoId: YouTubeVideoId,
  language: OutputLanguageSchema,
  source: z.enum(LESSON_SOURCES),
  status: z.enum(LESSON_STATUSES),
  spokenLanguage: z.string().nullable(),
  overview: z.string().nullable(),
  chapters: z.array(ChapterPublicSchema),
});
export type LessonPublic = z.infer<typeof LessonPublicSchema>;

export const VideoPublicSchema = z.object({
  youtubeVideoId: YouTubeVideoId,
  title: z.string(),
  channelTitle: z.string().nullable(),
  durationSeconds: z.number().int().positive(),
  thumbnailUrl: z.string().nullable(),
});
export type VideoPublic = z.infer<typeof VideoPublicSchema>;

/** What the configured AI provider can do (Section 4.5.1). The UI hides what it can't. */
export const CapabilitiesSchema = z.object({
  videoLessons: z.boolean(),
  videoClipping: z.boolean(),
  tutorClip: z.boolean(),
  agenticVideo: z.boolean(),
});
export type Capabilities = z.infer<typeof CapabilitiesSchema>;

export const LessonStatusResponseSchema = z.object({
  status: z.enum(LESSON_STATUSES),
  progress: z.object({ chaptersReady: z.number().int(), chaptersTotal: z.number().int() }),
  video: VideoPublicSchema,
  lesson: LessonPublicSchema.optional(),
  attempts: z.record(z.uuid(), z.object({ isCorrect: z.boolean() })),
  capabilities: CapabilitiesSchema,
  /** A job is queued behind a free-tier rate limit: show "Waiting for free AI capacity…", not an error. */
  waitingForCapacity: z.boolean(),
});
export type LessonStatusResponse = z.infer<typeof LessonStatusResponseSchema>;

/** Transcript paste limit (Section 5.8): 200 KB. */
export const MAX_TRANSCRIPT_CHARS = 200 * 1024;

export const CreateLessonRequestSchema = z.object({
  url: z.string().min(1).max(2048),
  language: OutputLanguageSchema,
  transcript: z.string().min(1).max(MAX_TRANSCRIPT_CHARS).optional(),
});
export type CreateLessonRequest = z.infer<typeof CreateLessonRequestSchema>;

export const CreateLessonResponseSchema = z.object({
  youtubeVideoId: YouTubeVideoId,
  language: OutputLanguageSchema,
  status: z.enum(LESSON_STATUSES),
  startSeconds: z.number().int().min(0).optional(),
});
export type CreateLessonResponse = z.infer<typeof CreateLessonResponseSchema>;

export const RetryLessonRequestSchema = z.object({
  language: OutputLanguageSchema,
  chapterPosition: z.number().int().min(0).optional(),
});
export type RetryLessonRequest = z.infer<typeof RetryLessonRequestSchema>;

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export const AttemptRequestSchema = z.object({ selectedIndex: z.number().int().min(0).max(3) });
export type AttemptRequest = z.infer<typeof AttemptRequestSchema>;

export const AttemptResultSchema = z.object({
  isCorrect: z.boolean(),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string(),
  misconception: z.string().nullable(),
});
export type AttemptResult = z.infer<typeof AttemptResultSchema>;

/** "Check my understanding" (Section 5.6.5). */
export const CheckQuestionRequestSchema = z.object({ conversationId: z.uuid(), messageId: z.uuid() });
export type CheckQuestionRequest = z.infer<typeof CheckQuestionRequestSchema>;
export const CheckQuestionResponseSchema = z.object({ question: QuestionPublicSchema });

// ---------------------------------------------------------------------------
// Tutor (Section 5.6)
// ---------------------------------------------------------------------------

export const TutorRequestSchema = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().min(1).max(2000),
  youtubeVideoId: YouTubeVideoId,
  language: OutputLanguageSchema,
  timestampSeconds: z.number().int().min(0),
  mode: z.enum(TUTOR_MODES),
  style: z.enum(TUTOR_STYLES).optional(),
  quickAction: z.enum(TUTOR_QUICK_ACTIONS).optional(),
  responseLanguage: OutputLanguageSchema.optional(),
  chapterPosition: z.number().int().min(0).optional(),
  pastedText: z.string().max(4000).optional(),
});
export type TutorRequest = z.infer<typeof TutorRequestSchema>;

/**
 * What the AI used for an answer, e.g. "video_clip:11:11-13:01", "lecture_index:10:41-13:11",
 * "chapter_notes:4", "transcript:10:41-13:11", "general_knowledge", "lite_model".
 */
export const ContextSourceSchema = z.string().regex(
  /^(video_clip|lecture_index|transcript):\d+:\d{2}(:\d{2})?-\d+:\d{2}(:\d{2})?$|^chapter_notes:\d+$|^(general_knowledge|whole_lecture|lite_model)$/,
);
export type ContextSource = z.infer<typeof ContextSourceSchema>;

export const TutorMessageMetadataSchema = z.object({
  conversationId: z.uuid(),
  contextSources: z.array(ContextSourceSchema),
  mode: z.enum(TUTOR_MODES),
  style: z.enum(TUTOR_STYLES).optional(),
  timestampSeconds: z.number().int().min(0),
  aborted: z.boolean().optional(),
});
export type TutorMessageMetadata = z.infer<typeof TutorMessageMetadataSchema>;

// ---------------------------------------------------------------------------
// Concepts and revision (Section 5.10)
// ---------------------------------------------------------------------------

export const CreateConceptRequestSchema = z.object({
  youtubeVideoId: YouTubeVideoId.optional(),
  language: OutputLanguageSchema.optional(),
  sourceSeconds: z.number().int().min(0).optional(),
  title: z.string().min(1).max(200),
  explanationMarkdown: z.string().max(8000).optional(),
  questionId: z.uuid().optional(),
  source: z.enum(CONCEPT_SOURCES),
});
export type CreateConceptRequest = z.infer<typeof CreateConceptRequestSchema>;

export const ConceptSchema = z.object({
  id: z.uuid(),
  youtubeVideoId: z.string().nullable(),
  language: OutputLanguageSchema.nullable(),
  sourceSeconds: z.number().int().nullable(),
  title: z.string(),
  explanationMarkdown: z.string().nullable(),
  questionId: z.uuid().nullable(),
  source: z.enum(CONCEPT_SOURCES),
  createdAt: z.string(),
});
export type Concept = z.infer<typeof ConceptSchema>;

export const RecallRatingSchema = z.enum(RECALL_RATINGS);

export const RevisionItemViewSchema = z.object({
  id: z.uuid(),
  concept: ConceptSchema,
  dueAt: z.string(),
  state: z.enum(REVISION_STATES),
  reps: z.number().int(),
  lapses: z.number().int(),
  lastRating: RecallRatingSchema.nullable(),
  /** Human-readable next interval per rating from ts-fsrs preview, e.g. { good: "3d" }. */
  intervals: z.record(RecallRatingSchema, z.string()),
  question: QuestionPublicSchema.nullable(),
});
export type RevisionItemView = z.infer<typeof RevisionItemViewSchema>;

export const ReviewRequestSchema = z.object({ rating: RecallRatingSchema });
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;

export const CreateConceptResponseSchema = z.object({ concept: ConceptSchema, revisionItem: RevisionItemViewSchema });

/** "Add all key terms to revision" (P1): one concept per key term of the lesson's ready chapters. */
export const KeyTermsRequestSchema = z.object({ youtubeVideoId: YouTubeVideoId, language: OutputLanguageSchema });
export type KeyTermsRequest = z.infer<typeof KeyTermsRequestSchema>;
export const KeyTermsResponseSchema = z.object({
  added: z.number().int().min(0),
  alreadySaved: z.number().int().min(0),
});
export type KeyTermsResponse = z.infer<typeof KeyTermsResponseSchema>;
export const RevisionFilterSchema = z.enum(["due", "upcoming", "all"]);
export const RevisionListResponseSchema = z.object({ items: z.array(RevisionItemViewSchema) });
export const ReviewResponseSchema = z.object({ revisionItem: RevisionItemViewSchema });

// ---------------------------------------------------------------------------
// Search (Section 5.9)
// ---------------------------------------------------------------------------

export const SearchRequestSchema = z.object({ query: z.string().trim().min(2).max(200), language: OutputLanguageSchema });
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchResultSchema = z.object({
  ref: z.string(),
  seconds: z.number().int().min(0),
  label: z.string(),
  why: z.string(),
  snippet: z.string(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema).max(3),
  /** Some chapters are still building: "Searching 3 of 8 chapters". */
  partial: z.object({ searched: z.number().int(), total: z.number().int() }).nullable(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

// ---------------------------------------------------------------------------
// Recap (Section 5.11)
// ---------------------------------------------------------------------------

export const RecapSchema = z.object({
  checkpoints: z.object({
    answered: z.number().int(),
    correct: z.number().int(),
    total: z.number().int(),
  }),
  worthReviewing: z.array(
    z.object({ position: z.number().int(), title: z.string(), startSeconds: z.number().int() }),
  ),
  savedConcepts: z.array(ConceptSchema),
  conceptsDue: z.number().int(),
});
export type Recap = z.infer<typeof RecapSchema>;
