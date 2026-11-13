import "server-only";

/**
 * Tutor (Section 5.6). Authenticated and quota-checked by the route; this module loads the
 * lesson context on the server (the client never sends lesson content), streams the answer, and
 * persists both messages.
 *
 * Attempt order: (1) Gemini with a video clip, when the packet asks for one; (2) the text model
 * chain without a clip. An attempt "succeeds" once it produces its first text. A clip attempt that
 * errors or stays silent for TUTOR_CLIP_TIMEOUT_MS falls back to (2) inside the same UI stream, and
 * the context chips change to say so. Rate limits fall down the chain; if everything is
 * rate-limited the student sees the `ai_busy` message.
 */
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type InferUIMessageChunk,
  type ModelMessage,
} from "ai";

import type { OutputLanguage } from "@/config/enums";
import { serverEnv } from "@/env";
import type { ModelSpec } from "@/lib/ai/capabilities";
import { buildContextPacket, fence, type PacketLesson } from "@/lib/ai/context-packet";
import { isRateLimitError, jobErrorCode } from "@/lib/ai/errors";
import { quickActionPrompt, tutorInstructions } from "@/lib/ai/prompts/tutor";
import { capabilities, languageModel, models, providerOptionsFor, youtubePart } from "@/lib/ai/provider";
import { recordAiCall } from "@/lib/ai/record-call";
import type { CurrentUser } from "@/lib/auth";
import { AppError, ERROR_MESSAGES } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCachedVideo } from "@/lib/youtube/videos";
import {
  parsePreferences,
  type ContextSource,
  type TutorMessageMetadata,
  type TutorRequest,
} from "@/types/contracts";
import type { Json } from "@/types/database";

import type { TutorUIMessage } from "./types";

export type { TutorUIMessage };
type TutorChunk = InferUIMessageChunk<TutorUIMessage>;

const HISTORY_LIMIT = 10;
const TEXT_FIRST_CHUNK_MS = 30_000;
const TUTOR_BUSY = "The tutor is busy. Retry.";

type SupabaseUser = Awaited<ReturnType<typeof createClient>>;

async function loadLessonForTutor(videoId: string, language: OutputLanguage): Promise<PacketLesson | null> {
  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, overview, source")
    .eq("youtube_video_id", videoId)
    .eq("output_language", language)
    .eq("prompt_version", serverEnv().PROMPT_VERSION)
    .maybeSingle();
  if (!lesson) return null;
  const { data: chapters } = await admin
    .from("lesson_chapters")
    .select("position, title, start_seconds, end_seconds, status, summary, notes_markdown, key_terms, formulas, segments")
    .eq("lesson_id", lesson.id)
    .order("position");
  return {
    overview: lesson.overview,
    source: lesson.source,
    chapters: (chapters ?? []).map((c) => ({
      position: c.position,
      title: c.title,
      startSeconds: c.start_seconds,
      endSeconds: c.end_seconds,
      status: c.status,
      summary: c.summary,
      notesMarkdown: c.notes_markdown,
      keyTerms: c.key_terms,
      formulas: c.formulas,
      segments: Array.isArray(c.segments)
        ? c.segments.flatMap((s) => {
            if (typeof s !== "object" || s === null || Array.isArray(s)) return [];
            const { startSeconds, endSeconds, speech, board } = s;
            if (typeof startSeconds !== "number" || typeof endSeconds !== "number" || typeof speech !== "string") return [];
            return [{ startSeconds, endSeconds, speech, board: typeof board === "string" ? board : null }];
          })
        : [],
    })),
  };
}

async function resolveConversation(supabase: SupabaseUser, user: CurrentUser, request: TutorRequest) {
  if (request.conversationId) {
    // RLS: only the owner can read it.
    const { data } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", request.conversationId)
      .eq("youtube_video_id", request.youtubeVideoId)
      .maybeSingle();
    if (!data) throw new AppError("not_found", "That conversation doesn't exist.");
    return data.id;
  }
  const title = request.message.replace(/\s+/g, " ").trim().slice(0, 80);
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: user.id, youtube_video_id: request.youtubeVideoId, title })
    .select("id")
    .single();
  if (error || !data) throw new AppError("internal");
  return data.id;
}

function textOf(parts: Json): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) => (p && typeof p === "object" && !Array.isArray(p) && p.type === "text" && typeof p.text === "string" ? p.text : ""))
    .join("");
}

/**
 * Read UI chunks until the first text arrives. Null means the attempt failed or stayed silent past
 * `deadline` (the SDK's first-chunk timer only starts once the response begins, and an overloaded
 * provider can hold the connection open far longer). The caller aborts the request on null.
 */
async function probe(stream: ReadableStream<TutorChunk>, deadline: number) {
  const reader = stream.getReader();
  const buffered: TutorChunk[] = [];
  for (;;) {
    const remaining = deadline - performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = await Promise.race([
      reader.read(),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), Math.max(0, remaining));
      }),
    ]);
    clearTimeout(timer);
    if (next === "timeout") {
      await reader.cancel().catch(() => {});
      return null;
    }
    const { done, value } = next;
    if (done) return null;
    if (value.type === "error" || value.type === "abort") {
      await reader.cancel().catch(() => {});
      return null;
    }
    if (value.type === "start" || value.type === "finish") continue;
    buffered.push(value);
    if (value.type === "text-delta") return { reader, buffered };
  }
}

export async function streamTutorAnswer(user: CurrentUser, request: TutorRequest, abortSignal: AbortSignal): Promise<Response> {
  const env = serverEnv();
  const supabase = await createClient();

  const video = await getCachedVideo(request.youtubeVideoId);
  if (!video) throw new AppError("not_found", "Open this lecture's lesson before asking the tutor.");

  const [conversationId, lesson, profile] = await Promise.all([
    resolveConversation(supabase, user, request),
    loadLessonForTutor(request.youtubeVideoId, request.language),
    supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle(),
  ]);
  const preferences = parsePreferences(profile.data?.preferences);

  const { data: history } = await supabase
    .from("messages")
    .select("role, parts")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  // Save the student's message before calling the model (Section 5.6.4).
  const userMetadata = {
    timestampSeconds: request.timestampSeconds,
    mode: request.mode,
    ...(request.style ? { style: request.style } : {}),
    ...(request.quickAction ? { quickAction: request.quickAction } : {}),
  };
  // A retry re-sends the question that got no answer: don't save (or send) it twice.
  const latest = history?.[0];
  const isRetry = latest?.role === "user" && textOf(latest.parts) === request.message;
  const { error: saveError } = isRetry
    ? { error: null }
    : await supabase.from("messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "user",
        parts: [{ type: "text", text: request.message }],
        metadata: userMetadata,
      });
  if (saveError) throw new AppError("internal");

  const caps = capabilities();
  const packet = buildContextPacket({
    t: request.timestampSeconds,
    durationSeconds: video.durationSeconds,
    lesson,
    preferences,
    tutorClipCapable: caps.tutorClip,
    clipMode: env.TUTOR_CLIP_MODE,
    clipBeforeSeconds: env.TUTOR_CLIP_BEFORE_SECONDS,
    clipAfterSeconds: env.TUTOR_CLIP_AFTER_SECONDS,
    quickAction: request.quickAction,
    chapterPosition: request.chapterPosition,
    pastedText: request.pastedText,
  });

  const priorMessages: ModelMessage[] = (history ?? [])
    .slice(isRetry ? 1 : 0)
    .reverse()
    .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: textOf(m.parts) }))
    .filter((m) => m.content.length > 0);
  const question = quickActionPrompt(request.quickAction, request.message);
  const responseLanguage = request.responseLanguage ?? request.language;

  type Attempt = { spec: ModelSpec; clip: boolean; sources: ContextSource[] };
  const attempts: Attempt[] = [];
  const videoSpec = models.video();
  if (packet.clip && videoSpec?.provider === "gemini") attempts.push({ spec: videoSpec, clip: true, sources: packet.sourcesWithClip });
  const textChain = models.main();
  textChain.forEach((spec, i) =>
    attempts.push({ spec, clip: false, sources: i > 0 ? [...packet.sourcesWithoutClip, "lite_model"] : packet.sourcesWithoutClip }),
  );
  if (attempts.length === 0) throw new AppError("ai_busy");

  const assistantId = crypto.randomUUID();
  const baseMetadata: TutorMessageMetadata = {
    conversationId,
    contextSources: [],
    mode: request.mode,
    ...(request.style ? { style: request.style } : {}),
    timestampSeconds: request.timestampSeconds,
  };
  let finalMetadata: TutorMessageMetadata = baseMetadata;
  let failure: "busy" | "error" | null = null;

  const stream = createUIMessageStream<TutorUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageId: assistantId, messageMetadata: baseMetadata });
      let rateLimited = 0;

      for (const attempt of attempts) {
        if (abortSignal.aborted) return;
        const started = performance.now();
        const firstChunkMs = attempt.clip ? env.TUTOR_CLIP_TIMEOUT_MS : TEXT_FIRST_CHUNK_MS;
        // Per-attempt abort: a silent attempt is cancelled so the next model can answer.
        const attemptAbort = new AbortController();
        let captured: unknown = null;
        const clipPart =
          attempt.clip && packet.clip ? [youtubePart(request.youtubeVideoId, attempt.spec, packet.clip, 1)] : [];
        const result = streamText({
          model: languageModel(attempt.spec),
          instructions: tutorInstructions({
            responseLanguage,
            mode: request.mode,
            style: request.style,
            quickAction: request.quickAction,
            mathDetail: preferences.mathDetail,
            tone: preferences.tone,
            hasLectureContext: packet.hasLectureText,
            hasClip: attempt.clip,
          }),
          messages: [
            ...priorMessages,
            {
              role: "user",
              content: [...clipPart, { type: "text", text: `${packet.contextText}\n\n<question>${fence(question)}</question>` }],
            },
          ],
          providerOptions: providerOptionsFor(attempt.spec, {
            thinkingLevel: "low",
            ...(attempt.clip ? { mediaResolution: env.TUTOR_CLIP_RESOLUTION } : {}),
          }),
          maxRetries: 0,
          abortSignal: AbortSignal.any([abortSignal, attemptAbort.signal]),
          timeout: { firstChunkMs },
          // The SDK's default logs the whole error, request body included (the student's question
          // and lecture text). The error is captured below and recorded as a safe code instead.
          onError: () => {},
        });
        const ui = toUIMessageStream({
          stream: result.stream,
          sendStart: false,
          sendFinish: false,
          onError: (error) => {
            captured = error;
            return TUTOR_BUSY;
          },
        });

        // sendStart/sendFinish are off, so these chunks carry no metadata of their own.
        const probed = await probe(ui as ReadableStream<TutorChunk>, started + firstChunkMs);
        if (!probed) {
          const silent = captured === null && !abortSignal.aborted;
          attemptAbort.abort();
          await recordAiCall({
            kind: "tutor",
            spec: attempt.spec,
            userId: user.id,
            durationMs: performance.now() - started,
            ok: false,
            errorCode: silent ? "model_timeout" : jobErrorCode(captured),
          });
          if (abortSignal.aborted) return;
          if (attempt.clip) continue; // clip failed or was slow: answer from the index and notes
          // A model that stays silent is treated like a busy one: try the next.
          if (silent || isRateLimitError(captured)) {
            rateLimited++;
            continue;
          }
          failure = "error";
          break;
        }

        finalMetadata = { ...baseMetadata, contextSources: attempt.sources };
        writer.write({ type: "message-metadata", messageMetadata: finalMetadata });
        for (const chunk of probed.buffered) writer.write(chunk);
        for (;;) {
          const { done, value } = await probed.reader.read();
          if (done) break;
          writer.write(value);
        }
        const usage = await Promise.resolve(result.totalUsage).catch(() => null);
        await recordAiCall({
          kind: "tutor",
          spec: attempt.spec,
          userId: user.id,
          inputTokens: usage?.inputTokens ?? null,
          outputTokens: usage?.outputTokens ?? null,
          durationMs: performance.now() - started,
          ok: captured === null,
          errorCode: captured === null ? null : jobErrorCode(captured),
        });
        writer.write({ type: "finish", messageMetadata: finalMetadata });
        return;
      }

      if (abortSignal.aborted) return;
      if (failure === null) failure = rateLimited > 0 ? "busy" : "error";
      writer.write({ type: "error", errorText: failure === "busy" ? ERROR_MESSAGES.ai_busy : TUTOR_BUSY });
    },
    onError: () => TUTOR_BUSY,
    onEnd: async ({ responseMessage, isAborted }) => {
      const parts = responseMessage.parts.filter((p) => p.type === "text" && p.text.length > 0);
      if (parts.length === 0) return;
      const metadata: TutorMessageMetadata = { ...finalMetadata, ...(isAborted ? { aborted: true } : {}) };
      const { error } = await supabase.from("messages").insert({
        id: assistantId,
        conversation_id: conversationId,
        user_id: user.id,
        role: "assistant",
        parts: parts as unknown as NonNullable<Json>,
        metadata: metadata as unknown as NonNullable<Json>,
      });
      if (error) console.error("[tutor] saving the answer failed:", error.code);
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    },
  });

  return createUIMessageStreamResponse({ stream });
}

/** The latest conversation for this video (one active conversation per user and video). */
export async function loadLatestConversation(videoId: string): Promise<{ id: string; messages: TutorUIMessage[] } | null> {
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("youtube_video_id", videoId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conversation) return null;
  const { data: rows } = await supabase
    .from("messages")
    .select("id, role, parts, metadata")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(100);
  const messages: TutorUIMessage[] = (rows ?? []).map((m) => {
    const meta = m.metadata && typeof m.metadata === "object" && !Array.isArray(m.metadata) ? m.metadata : {};
    return {
      id: m.id,
      role: m.role === "assistant" ? "assistant" : "user",
      parts: [{ type: "text", text: textOf(m.parts) }],
      metadata: {
        conversationId: conversation.id,
        contextSources: Array.isArray(meta.contextSources) ? (meta.contextSources.filter((s) => typeof s === "string") as ContextSource[]) : [],
        mode: meta.mode === "explain_differently" ? "explain_differently" : "ask",
        timestampSeconds: typeof meta.timestampSeconds === "number" ? meta.timestampSeconds : 0,
        ...(meta.aborted === true ? { aborted: true } : {}),
      },
    };
  });
  return { id: conversation.id, messages };
}
