"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useRef, useState } from "react";

import type { OutputLanguage } from "@/config/enums";
import type { TutorUIMessage } from "@/lib/tutor/types";
import { ApiErrorSchema, TutorMessageMetadataSchema, TutorRequestSchema, type TutorRequest } from "@/types/contracts";

/** What a caller chooses; the hook fills in the video, language, time and conversation. */
export type TutorAsk = Pick<TutorRequest, "message" | "mode"> &
  Partial<Pick<TutorRequest, "style" | "quickAction" | "chapterPosition" | "pastedText" | "timestampSeconds">>;

const GENERIC_ERROR = "The tutor is busy. Retry.";

/** Turn a transport error (JSON body) or a stream error (safe text) into what the student reads. */
function errorMessage(error: Error | undefined): string | null {
  if (!error) return null;
  try {
    const parsed = ApiErrorSchema.safeParse(JSON.parse(error.message));
    if (parsed.success) return parsed.data.error.message;
  } catch {
    // Not JSON: a stream error, whose text the server already made safe.
  }
  if (error.message === "Failed to fetch" || error.name === "TypeError") {
    return "Couldn't reach Sapience. Check your connection and try again.";
  }
  return error.message && error.message.length < 300 ? error.message : GENERIC_ERROR;
}

/**
 * Tutor chat state (Section 5.6). Lives in the lesson screen so the conversation survives
 * switching tabs and can be started from a checkpoint ("Explain differently").
 * The client sends only a `TutorRequest`, never lesson content or history.
 */
export function useTutor({
  videoId,
  language,
  initialMessages,
  getTimestamp,
}: {
  videoId: string;
  language: OutputLanguage;
  initialMessages: TutorUIMessage[];
  getTimestamp: () => number;
}) {
  const [transport] = useState(
    () =>
      new DefaultChatTransport<TutorUIMessage>({
        api: "/api/tutor",
        // The request body is the validated TutorRequest passed with each send; history stays on the server.
        prepareSendMessagesRequest: ({ body }) => ({ body: TutorRequestSchema.parse(body) }),
      }),
  );
  const chat = useChat<TutorUIMessage>({
    id: `tutor-${videoId}`,
    messages: initialMessages,
    transport,
    messageMetadataSchema: TutorMessageMetadataSchema,
  });
  const { messages, sendMessage, regenerate, setMessages, stop, status, error, clearError } = chat;

  const [responseLanguage, setResponseLanguage] = useState<OutputLanguage>(language);
  const lastRequest = useRef<TutorRequest | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  // Answers the student stopped mid-stream. The server marks them `aborted` too, but that
  // metadata never reaches a client that has already disconnected.
  const [stoppedIds, setStoppedIds] = useState<ReadonlySet<string>>(() => new Set());

  // The server creates the conversation on the first question and returns its ID in metadata.
  const conversationId = [...messages].reverse().find((m) => m.metadata?.conversationId)?.metadata?.conversationId;

  const ask = useCallback(
    (input: TutorAsk) => {
      const request: TutorRequest = {
        ...(conversationId ? { conversationId } : {}),
        youtubeVideoId: videoId,
        language,
        timestampSeconds: Math.max(0, Math.floor(input.timestampSeconds ?? getTimestamp())),
        ...(responseLanguage !== language ? { responseLanguage } : {}),
        ...input,
        message: input.message.trim().slice(0, 2000),
      };
      lastRequest.current = request;
      setCanRetry(true);
      clearError();
      void sendMessage({ text: request.message }, { body: request });
    },
    [conversationId, videoId, language, getTimestamp, responseLanguage, sendMessage, clearError],
  );

  const retry = useCallback(() => {
    if (!lastRequest.current) return;
    clearError();
    void regenerate({ body: lastRequest.current });
  }, [regenerate, clearError]);

  /** Drop the failed turn and hand its text back for editing. */
  const takeBackLastQuestion = useCallback((): string => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const index = lastUser ? messages.lastIndexOf(lastUser) : -1;
    clearError();
    if (index === -1) return "";
    setMessages(messages.slice(0, index));
    return lastUser!.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  }, [messages, setMessages, clearError]);

  const newChat = useCallback(() => {
    void stop();
    clearError();
    lastRequest.current = null;
    setCanRetry(false);
    setMessages([]);
  }, [stop, clearError, setMessages]);

  const stopAnswer = useCallback(() => {
    const last = messages.at(-1);
    if (status === "streaming" && last?.role === "assistant") setStoppedIds((ids) => new Set(ids).add(last.id));
    void stop();
  }, [messages, status, stop]);

  /** A partial answer: stopped by the student, or cut off on the server. */
  const isIncomplete = useCallback(
    (message: TutorUIMessage) => message.role === "assistant" && (message.metadata?.aborted === true || stoppedIds.has(message.id)),
    [stoppedIds],
  );

  return {
    messages,
    status,
    busy: status === "submitted" || status === "streaming",
    error: errorMessage(error),
    conversationId: conversationId ?? null,
    responseLanguage,
    setResponseLanguage,
    ask,
    retry,
    canRetry,
    isIncomplete,
    stop: stopAnswer,
    takeBackLastQuestion,
    newChat,
  };
}

export type TutorState = ReturnType<typeof useTutor>;
