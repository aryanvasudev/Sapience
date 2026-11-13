/**
 * Usage numbers from `ai_calls` (Section 3.2 P1, Section 13): real tokens and time per call kind,
 * per model and per lesson, for the unit-economics slide. Pure, unit tested.
 */

export type CallRow = {
  kind: string;
  provider: string;
  model: string;
  lesson_id: string | null;
  byok: boolean;
  ok: boolean;
  fallback_from: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number | null;
};

export type Bucket = {
  key: string;
  calls: number;
  ok: number;
  byok: number;
  fallbacks: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};

const LESSON_KINDS = new Set(["outline", "chapters", "full", "transcript"]);

const empty = (key: string): Bucket => ({ key, calls: 0, ok: 0, byok: 0, fallbacks: 0, inputTokens: 0, outputTokens: 0, durationMs: 0 });

function add(b: Bucket, r: CallRow) {
  b.calls++;
  if (r.ok) b.ok++;
  if (r.byok) b.byok++;
  if (r.fallback_from) b.fallbacks++;
  b.inputTokens += r.input_tokens ?? 0;
  b.outputTokens += r.output_tokens ?? 0;
  b.durationMs += r.duration_ms ?? 0;
}

function group(rows: CallRow[], keyOf: (r: CallRow) => string | null): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const key = keyOf(r);
    if (key === null) continue;
    let b = map.get(key);
    if (!b) map.set(key, (b = empty(key)));
    add(b, r);
  }
  return [...map.values()].sort((a, b) => b.calls - a.calls);
}

export function summarizeCalls(rows: CallRow[]) {
  const total = empty("all");
  for (const r of rows) add(total, r);
  return {
    total,
    byKind: group(rows, (r) => r.kind),
    byModel: group(rows, (r) => `${r.provider}:${r.model}`),
    /** Lesson-building calls only (tutor/search calls also carry a lesson id). */
    byLesson: group(rows, (r) => (r.lesson_id && LESSON_KINDS.has(r.kind) ? r.lesson_id : null)),
  };
}

/** Mean per successful call, rounded; null when there were none. */
export const perCall = (b: Bucket, field: "inputTokens" | "outputTokens" | "durationMs"): number | null =>
  b.calls === 0 ? null : Math.round(b[field] / b.calls);
