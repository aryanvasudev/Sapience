import "server-only";

/**
 * Structured generation shared by the lesson runners, search and check questions.
 *
 * - One model call = one `ai_calls` row (ok or not).
 * - `maxRetries: 1` at the SDK level (Section 5.4).
 * - If Gemini rejects the JSON schema as too complex, retry once with `structuredOutputs: false`
 *   (the schema is then described in the prompt and still validated by the SDK).
 * - `repair`: run code validation on the output; on failure, call once more with the errors
 *   appended to the prompt (Section 5.3). A second failure throws `InvalidLessonOutputError`.
 */
import { APICallError, generateText, Output, type UserContent } from "ai";
import type { z } from "zod";

import type { AiCallKind } from "@/config/enums";

import type { ModelSpec } from "./capabilities";
import { jobErrorCode, rootError } from "./errors";
import { withFallback } from "./fallback";
import { languageModel, providerOptionsFor, type CallTuning } from "./provider";
import { recordAiCall } from "./record-call";

export class InvalidLessonOutputError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Model output failed validation: ${problems.slice(0, 5).join("; ")}`);
    this.name = "InvalidOutputError";
    this.problems = problems;
  }
}

export type Usage = { inputTokens: number; outputTokens: number; durationMs: number };

type StructuredArgs<S extends z.ZodType> = {
  spec: ModelSpec;
  kind: AiCallKind;
  schema: S;
  instructions: string;
  /** User message parts. Put video parts first and text after (Gemini guidance). */
  content: UserContent;
  tuning?: CallTuning;
  forVideo?: boolean;
  timeoutMs?: number;
  record: { lessonId?: string | null; userId?: string | null; fallbackFrom?: ModelSpec | null };
};

function isSchemaRejected(error: unknown): boolean {
  const root = rootError(error);
  return (
    APICallError.isInstance(root) &&
    root.statusCode === 400 &&
    /invalid argument|schema/i.test(typeof root.responseBody === "string" ? root.responseBody : root.message)
  );
}

/** One structured call (with the schema-rejection retry), recorded in `ai_calls`. */
export async function generateStructured<S extends z.ZodType>(
  args: StructuredArgs<S>,
): Promise<{ output: z.infer<S>; usage: Usage }> {
  const attempt = async (structuredOutputs: boolean) => {
    const started = performance.now();
    try {
      const result = await generateText({
        model: languageModel(args.spec, { forVideo: args.forVideo }),
        instructions: args.instructions,
        messages: [{ role: "user", content: args.content }],
        output: Output.object({ schema: args.schema }),
        providerOptions: providerOptionsFor(args.spec, { ...args.tuning, structuredOutputs }),
        maxRetries: 1,
        ...(args.timeoutMs ? { timeout: args.timeoutMs } : {}),
      });
      const usage: Usage = {
        inputTokens: result.totalUsage.inputTokens ?? 0,
        outputTokens: result.totalUsage.outputTokens ?? 0,
        durationMs: performance.now() - started,
      };
      await recordAiCall({ kind: args.kind, spec: args.spec, ...args.record, ...usage, ok: true });
      return { output: result.output as z.infer<S>, usage };
    } catch (error) {
      await recordAiCall({
        kind: args.kind,
        spec: args.spec,
        ...args.record,
        durationMs: performance.now() - started,
        ok: false,
        errorCode: jobErrorCode(error),
      });
      throw error;
    }
  };

  try {
    return await attempt(args.tuning?.structuredOutputs ?? true);
  } catch (error) {
    if (args.spec.provider === "gemini" && args.tuning?.structuredOutputs !== false && isSchemaRejected(error)) {
      return attempt(false);
    }
    throw error;
  }
}

/**
 * Structured call with a code-level validator and one repair retry. `validate` returns the
 * cleaned value, or a list of problems.
 */
export async function generateValidated<S extends z.ZodType, T>(
  args: StructuredArgs<S>,
  validate: (output: z.infer<S>) => { ok: true; value: T } | { ok: false; problems: string[] },
): Promise<{ value: T; usage: Usage }> {
  const first = await generateStructured(args);
  const checked = validate(first.output);
  if (checked.ok) return { value: checked.value, usage: first.usage };

  const repairText =
    "Your previous answer had these problems. Return the whole answer again with them fixed:\n" +
    checked.problems.map((p) => `- ${p}`).join("\n");
  const second = await generateStructured({
    ...args,
    content: [...(Array.isArray(args.content) ? args.content : [{ type: "text" as const, text: args.content }]), { type: "text", text: repairText }],
  });
  const rechecked = validate(second.output);
  const usage: Usage = {
    inputTokens: first.usage.inputTokens + second.usage.inputTokens,
    outputTokens: first.usage.outputTokens + second.usage.outputTokens,
    durationMs: first.usage.durationMs + second.usage.durationMs,
  };
  if (!rechecked.ok) throw new InvalidLessonOutputError(rechecked.problems);
  return { value: rechecked.value, usage };
}

/**
 * A model that isn't the last in its video chain gets this long before the next one takes over.
 * A busy model can hold a video request open for minutes without answering; this keeps room for
 * the next model inside the job's 300 s budget.
 */
const VIDEO_HANDOVER_TIMEOUT_MS = 120_000;

/**
 * A text model that isn't the last in its chain gets this long before the next one takes over.
 * Short enough that a first call plus a repair call still fit the job's 300 s budget.
 */
const TEXT_HANDOVER_TIMEOUT_MS = 60_000;

/** A timeout or a server-side error is the model's problem, not the input's: try the next one. */
function handsOverToNextModel(error: unknown): boolean {
  if (jobErrorCode(error) === "model_timeout") return true;
  const root = rootError(error);
  return APICallError.isInstance(root) && root.statusCode !== undefined && root.statusCode >= 500;
}

/**
 * Validated video call down the video chain (main → lite on Gemini). A model that is out of quota,
 * overloaded, failing server-side or silent past `VIDEO_HANDOVER_TIMEOUT_MS` hands over to the next one. `content` is
 * built per model because the video part depends on the provider.
 */
export async function generateValidatedOnVideoChain<S extends z.ZodType, T>(
  chain: ModelSpec[],
  args: Omit<StructuredArgs<S>, "spec" | "content" | "timeoutMs"> & { content: (spec: ModelSpec) => UserContent },
  validate: (output: z.infer<S>) => { ok: true; value: T } | { ok: false; problems: string[] },
): Promise<{ value: T; usage: Usage; spec: ModelSpec }> {
  const result = await withFallback(
    chain,
    (spec) =>
      generateValidated(
        {
          ...args,
          spec,
          content: args.content(spec),
          ...(spec !== chain[chain.length - 1] ? { timeoutMs: VIDEO_HANDOVER_TIMEOUT_MS } : {}),
          record: { ...args.record, fallbackFrom: spec === chain[0] ? null : chain[0] },
        },
        validate,
      ),
    { fallBackOn: handsOverToNextModel },
  );
  return { ...result.value, spec: result.model };
}

/**
 * Text-tier structured call down the fallback chain (main → lite → OpenRouter). A model that is
 * out of quota, overloaded, failing server-side or silent past its deadline hands over to the next
 * one; every model but the last gets at most `TEXT_HANDOVER_TIMEOUT_MS`.
 */
export async function generateStructuredWithFallback<S extends z.ZodType>(
  chain: ModelSpec[],
  args: Omit<StructuredArgs<S>, "spec">,
): Promise<{ output: z.infer<S>; usage: Usage; spec: ModelSpec; fallbackFrom: ModelSpec | null }> {
  const last = chain[chain.length - 1];
  const result = await withFallback(
    chain,
    (spec) =>
      generateStructured({
        ...args,
        spec,
        ...(spec !== last ? { timeoutMs: Math.min(args.timeoutMs ?? TEXT_HANDOVER_TIMEOUT_MS, TEXT_HANDOVER_TIMEOUT_MS) } : {}),
        record: { ...args.record, fallbackFrom: spec === chain[0] ? null : chain[0] },
      }),
    { fallBackOn: handsOverToNextModel },
  );
  return { ...result.value, spec: result.model, fallbackFrom: result.fallbackFrom };
}
