import type { ModelSpec } from "@/lib/ai/capabilities";
import type { Usage } from "@/lib/ai/generate";
import type { OutputLanguage } from "@/config/enums";
import type { Database } from "@/types/database";

export type JobRow = Database["public"]["Tables"]["lesson_jobs"]["Row"];

export type LessonContext = {
  id: string;
  youtubeVideoId: string;
  language: OutputLanguage;
  overview: string | null;
  durationSeconds: number;
};

export type RunnerResult = { usage: Usage; spec: ModelSpec };

export const addUsage = (a: Usage, b: Usage): Usage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  durationMs: a.durationMs + b.durationMs,
});

export const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, durationMs: 0 };
