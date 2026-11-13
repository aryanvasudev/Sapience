/**
 * Every option list in Sapience is defined once, here, and reused by Zod schemas,
 * database check constraints and UI. `tests/unit/enums-migrations.test.ts` fails if a
 * migration's check constraint drifts from these lists.
 */

export const OUTPUT_LANGUAGES = ["en", "hi", "hinglish"] as const;
export type OutputLanguage = (typeof OUTPUT_LANGUAGES)[number];

export const OUTPUT_LANGUAGE_NAMES: Record<OutputLanguage, string> = {
  en: "English",
  hi: "Hindi",
  hinglish: "Hinglish",
};

export const LESSON_SOURCES = ["gemini_video", "transcript_paste", "fixture"] as const;
export type LessonSource = (typeof LESSON_SOURCES)[number];

export const LESSON_STATUSES = ["queued", "outlining", "building", "ready", "failed"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const CHAPTER_STATUSES = ["pending", "ready", "failed"] as const;
export type ChapterStatus = (typeof CHAPTER_STATUSES)[number];

export const JOB_KINDS = ["full", "outline", "chapters", "transcript"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_STATUSES = ["queued", "running", "done", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Safe, user-presentable failure codes stored on lessons and jobs. Never raw provider messages. */
export const JOB_ERROR_CODES = [
  "video_unavailable",
  "model_timeout",
  "invalid_output",
  "quota",
  "unknown",
] as const;
export type JobErrorCode = (typeof JOB_ERROR_CODES)[number];

export const QUESTION_SOURCES = ["checkpoint", "tutor_check"] as const;
export type QuestionSource = (typeof QUESTION_SOURCES)[number];

export const AI_CALL_KINDS = [
  "outline",
  "chapters",
  "full",
  "transcript",
  "tutor",
  "check",
  "search",
  "whole_lecture",
] as const;
export type AiCallKind = (typeof AI_CALL_KINDS)[number];

export const AI_TEXT_PROVIDERS = ["gemini", "openrouter"] as const;
export type AiTextProvider = (typeof AI_TEXT_PROVIDERS)[number];

export const AI_VIDEO_PROVIDERS = ["gemini", "openrouter", "none"] as const;
export type AiVideoProvider = (typeof AI_VIDEO_PROVIDERS)[number];

export const BYOK_PROVIDERS = ["gemini", "openrouter"] as const;
export type ByokProvider = (typeof BYOK_PROVIDERS)[number];

export const MESSAGE_ROLES = ["user", "assistant"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const CONCEPT_SOURCES = ["checkpoint", "tutor", "chapter", "key_term", "manual"] as const;
export type ConceptSource = (typeof CONCEPT_SOURCES)[number];

export const REVISION_STATES = ["new", "learning", "review", "relearning"] as const;
export type RevisionState = (typeof REVISION_STATES)[number];

export const RECALL_RATINGS = ["again", "hard", "good", "easy"] as const;
export type RecallRating = (typeof RECALL_RATINGS)[number];

export const NOTE_KINDS = ["note", "bookmark"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const QUOTA_KINDS = ["lesson", "ai"] as const;
export type QuotaKind = (typeof QUOTA_KINDS)[number];

export const LEARNER_LEVELS = ["school", "college", "exam_prep", "self_learner"] as const;
export type LearnerLevel = (typeof LEARNER_LEVELS)[number];

export const LEARNER_LEVEL_NAMES: Record<LearnerLevel, string> = {
  school: "School",
  college: "College",
  exam_prep: "Preparing for an exam",
  self_learner: "Learning on my own",
};

export const MATH_DETAIL_LEVELS = ["light", "standard", "detailed"] as const;
export type MathDetail = (typeof MATH_DETAIL_LEVELS)[number];

export const MATH_DETAIL_NAMES: Record<MathDetail, string> = {
  light: "Light — the idea, not the algebra",
  standard: "Standard",
  detailed: "Detailed — show every step",
};

export const TUTOR_STYLES = [
  "intuition",
  "step_by_step_math",
  "analogy",
  "worked_example",
  "simpler",
] as const;
export type TutorStyle = (typeof TUTOR_STYLES)[number];

export const TUTOR_STYLE_NAMES: Record<TutorStyle, string> = {
  intuition: "Intuition",
  step_by_step_math: "Step-by-step maths",
  analogy: "Analogy",
  worked_example: "Worked example",
  simpler: "Simpler",
};

export const TONES = ["direct", "encouraging"] as const;
export type Tone = (typeof TONES)[number];

export const TUTOR_MODES = ["ask", "explain_differently"] as const;
export type TutorMode = (typeof TUTOR_MODES)[number];

export const TUTOR_QUICK_ACTIONS = ["lost", "board"] as const;
export type TutorQuickAction = (typeof TUTOR_QUICK_ACTIONS)[number];

export const TUTOR_CLIP_MODES = ["on_demand", "always"] as const;
export type TutorClipMode = (typeof TUTOR_CLIP_MODES)[number];

export const MEDIA_RESOLUTIONS = [
  "MEDIA_RESOLUTION_LOW",
  "MEDIA_RESOLUTION_MEDIUM",
  "MEDIA_RESOLUTION_HIGH",
] as const;
export type MediaResolution = (typeof MEDIA_RESOLUTIONS)[number];

/** Error codes returned by the API as `{ error: { code, message } }` (Section 10). */
export const APP_ERROR_CODES = [
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "payload_too_large",
  "internal",
  "invalid_url",
  "video_not_found",
  "video_private",
  "video_not_embeddable",
  "video_age_restricted",
  "video_live",
  "video_duration",
  "youtube_quota",
  "video_ai_unavailable",
  "lesson_daily_limit",
  "guest_lesson_limit",
  "global_lesson_limit",
  "ai_daily_limit",
  "ai_busy",
  "grading_failed",
] as const;
export type AppErrorCode = (typeof APP_ERROR_CODES)[number];
