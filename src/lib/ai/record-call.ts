import "server-only";

import type { AiCallKind } from "@/config/enums";
import { createAdminClient } from "@/lib/supabase/admin";

import type { ModelSpec } from "./capabilities";

export type AiCallRecord = {
  kind: AiCallKind;
  spec: ModelSpec;
  userId?: string | null;
  lessonId?: string | null;
  fallbackFrom?: ModelSpec | null;
  byok?: boolean;
  inputTokens?: number | null;
  outputTokens?: number | null;
  durationMs: number;
  ok: boolean;
  errorCode?: string | null;
};

/** Write one `ai_calls` row. Never throws: losing a usage row must not fail the user's request. */
export async function recordAiCall(record: AiCallRecord): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("ai_calls")
      .insert({
        kind: record.kind,
        provider: record.spec.provider,
        model: record.spec.modelId,
        fallback_from: record.fallbackFrom ? `${record.fallbackFrom.provider}:${record.fallbackFrom.modelId}` : null,
        byok: record.byok ?? false,
        user_id: record.userId ?? null,
        lesson_id: record.lessonId ?? null,
        input_tokens: record.inputTokens ?? null,
        output_tokens: record.outputTokens ?? null,
        duration_ms: Math.round(record.durationMs),
        ok: record.ok,
        error_code: record.errorCode ?? null,
      });
    if (error) console.error("[ai_calls] insert failed:", error.code);
  } catch (error) {
    console.error("[ai_calls] insert threw:", error instanceof Error ? error.name : "unknown");
  }
}
