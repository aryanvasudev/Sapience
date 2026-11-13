"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import {
  ErrorIcon,
  FactCheckIcon,
  ForumIcon,
  HelpIcon,
  KeyboardArrowDownIcon,
  LightbulbIcon,
  ProgressActivityIcon,
  RefreshIcon,
  SendIcon,
  StopCircleIcon,
  SummarizeIcon,
  TranslateIcon,
} from "@/components/icons";
import { AiLabel } from "@/components/shared/ai-label";
import { Markdown } from "@/components/shared/markdown";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  OUTPUT_LANGUAGE_NAMES,
  OUTPUT_LANGUAGES,
  TUTOR_STYLE_NAMES,
  TUTOR_STYLES,
  type OutputLanguage,
  type TutorStyle,
} from "@/config/enums";
import { QuestionCard } from "@/features/lesson/components/question-card";
import { requestJson } from "@/lib/client-api";
import { contextSourcesLine } from "@/lib/context-sources";
import { formatTimestamp } from "@/lib/format";
import type { TutorUIMessage } from "@/lib/tutor/types";
import { SaveConceptButton } from "@/features/revision/components/save-concept-button";
import { CheckQuestionResponseSchema, type CreateConceptRequest, type QuestionPublic } from "@/types/contracts";

import type { TutorState } from "../hooks/use-tutor";

/** "Check my understanding" appears under answers longer than this (Section 5.6.5). */
const CHECK_MIN_CHARS = 400;

const textOf = (m: TutorUIMessage) => m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");

export function TutorPanel({
  tutor,
  durationSeconds,
  time,
  chapterTitle,
  chapterPosition,
  tutorClip,
  defaultStyle,
  onSeek,
  videoId,
  language,
}: {
  videoId: string;
  language: OutputLanguage;
  tutor: TutorState;
  durationSeconds: number;
  /** Current playback position; questions are asked "at" this moment. */
  time: number;
  chapterTitle: string | null;
  chapterPosition: number | null;
  /** The provider can send a clip of the video, so "What's on the board?" works. */
  tutorClip: boolean;
  defaultStyle: TutorStyle;
  onSeek: (seconds: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { messages, busy, error, status } = tutor;
  const position = chapterPosition ?? undefined;
  const reduce = useReducedMotion();
  // Messages already on screen when the panel mounts (the saved conversation) appear without an
  // entrance; only new ones rise in, once, when they are added. Streaming text never re-animates.
  const [restored] = useState(() => new Set(messages.map((m) => m.id)));

  // Keep the newest text in view while it streams.
  const lastText = messages.length > 0 ? textOf(messages[messages.length - 1]).length : 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, lastText, error]);

  const send = () => {
    const message = draft.trim();
    if (!message || busy) return;
    tutor.ask({ message, mode: "ask", chapterPosition: position });
    setDraft("");
  };

  const explainDifferently = (style: TutorStyle) =>
    tutor.ask({
      message: `Explain it differently: ${TUTOR_STYLE_NAMES[style].toLowerCase()}.`,
      mode: "explain_differently",
      style,
      chapterPosition: position,
    });

  return (
    <section aria-label="Tutor" className="flex min-h-[28rem] flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[0.8125rem] text-faint">
          Asking at <span className="font-mono text-[0.75rem] text-muted-foreground tabular-nums">{formatTimestamp(time)}</span>
          {chapterTitle ? ` · ${chapterTitle}` : ""}
        </p>
        {messages.length > 0 ? (
          <Button type="button" variant="ghost" size="xs" className="-mr-2 text-muted-foreground" onClick={tutor.newChat} disabled={busy}>
            New chat
          </Button>
        ) : null}
      </div>

      <div role="log" aria-live="polite" aria-busy={busy} className="grid flex-1 content-start gap-5">
        {messages.length === 0 ? (
          <div className="grid gap-1.5 rounded-2xl border border-dashed p-5 text-sm">
            <p className="flex items-center gap-2 text-[0.9375rem] font-medium">
              <ForumIcon className="size-4.5 text-faint" />
              Stuck on something?
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Ask about what&apos;s on screen. The tutor knows where you are in the lecture and uses the lecturer&apos;s own terms.
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const asked = i > 0 && messages[i - 1].role === "user" ? textOf(messages[i - 1]) : "";
            const at = m.metadata?.timestampSeconds ?? 0;
            const title = (asked.split("\n")[0] || `Tutor answer at ${formatTimestamp(at)}`).slice(0, 120);
            return (
              <motion.div
                key={m.id}
                className="grid min-w-0"
                initial={restored.has(m.id) ? false : reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <Message
                  message={m}
                  incomplete={tutor.isIncomplete(m)}
                  onRetry={i === messages.length - 1 && !busy && !error && tutor.canRetry ? tutor.retry : undefined}
                  streaming={busy && i === messages.length - 1 && m.role === "assistant"}
                  durationSeconds={durationSeconds}
                  onSeek={onSeek}
                  saveAs={{
                    youtubeVideoId: videoId,
                    language,
                    sourceSeconds: at,
                    title,
                    explanationMarkdown: textOf(m).slice(0, 8000),
                    source: "tutor",
                  }}
                />
              </motion.div>
            );
          })
        )}
        {status === "submitted" ? (
          <p className="flex animate-fade items-center gap-2 text-sm text-muted-foreground">
            <ProgressActivityIcon className="size-4 animate-spin text-faint motion-reduce:animate-none" />
            Thinking…
          </p>
        ) : null}
        {error ? (
          <div role="alert" className="grid animate-fade gap-2.5 rounded-[10px] border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="flex items-start gap-2 text-destructive">
              <ErrorIcon className="mt-px size-4.5 shrink-0" />
              {error}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={tutor.retry}>
                <RefreshIcon />
                Retry
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(tutor.takeBackLastQuestion());
                  inputRef.current?.focus();
                }}
              >
                Edit question
              </Button>
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 grid gap-2.5 bg-background pt-2 pb-1">
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              tutor.ask({
                message: `I'm lost at ${formatTimestamp(time)}`,
                mode: "explain_differently",
                style: "simpler",
                quickAction: "lost",
                chapterPosition: position,
              })
            }
          >
            <HelpIcon />
            I&apos;m lost
          </Button>
          {tutorClip ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                tutor.ask({
                  message: `What's on the board at ${formatTimestamp(time)}?`,
                  mode: "ask",
                  quickAction: "board",
                  chapterPosition: position,
                })
              }
            >
              <SummarizeIcon />
              What&apos;s on the board?
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" disabled={busy}>
                <LightbulbIcon />
                Explain differently
                <KeyboardArrowDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Explain it with…</DropdownMenuLabel>
              {[defaultStyle, ...TUTOR_STYLES.filter((s) => s !== defaultStyle)].map((style) => (
                <DropdownMenuItem key={style} onSelect={() => explainDifferently(style)}>
                  {TUTOR_STYLE_NAMES[style]}
                  {style === defaultStyle ? <span className="ml-auto text-xs text-muted-foreground">Your default</span> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="grid gap-1.5 rounded-2xl border bg-card p-2 transition-[border-color,box-shadow] duration-200 ease-(--ease-out) focus-within:border-brand/50 focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_14%,transparent)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
        >
          <label htmlFor="tutor-input" className="sr-only">
            Ask the tutor
          </label>
          <Textarea
            id="tutor-input"
            ref={inputRef}
            value={draft}
            maxLength={2000}
            rows={2}
            placeholder="Ask about this part of the lecture…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            className="max-h-40 min-h-12 resize-none border-0 bg-transparent px-1.5 py-1 text-sm shadow-none outline-none placeholder:text-faint focus-visible:ring-0 focus-visible:outline-none dark:bg-transparent"
          />
          <div className="flex items-center justify-between gap-2">
            <LanguageChip value={tutor.responseLanguage} onChange={tutor.setResponseLanguage} />
            {busy ? (
              <Button type="button" size="sm" variant="secondary" onClick={tutor.stop}>
                <StopCircleIcon />
                Stop
              </Button>
            ) : (
              <Button type="submit" size="sm" disabled={draft.trim().length === 0}>
                <SendIcon />
                Ask
              </Button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

function LanguageChip({ value, onChange }: { value: OutputLanguage; onChange: (l: OutputLanguage) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="xs" variant="ghost" className="text-muted-foreground">
          <TranslateIcon />
          Answer in {OUTPUT_LANGUAGE_NAMES[value]}
          <KeyboardArrowDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Answer language</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as OutputLanguage)}>
          {OUTPUT_LANGUAGES.map((l) => (
            <DropdownMenuRadioItem key={l} value={l}>
              {OUTPUT_LANGUAGE_NAMES[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Message({
  message,
  incomplete,
  onRetry,
  streaming,
  durationSeconds,
  onSeek,
  saveAs,
}: {
  message: TutorUIMessage;
  incomplete: boolean;
  /** Offered on the latest answer when it is incomplete. */
  onRetry?: () => void;
  streaming: boolean;
  durationSeconds: number;
  onSeek: (seconds: number) => void;
  saveAs: CreateConceptRequest;
}) {
  const text = textOf(message);
  if (message.role === "user") {
    return (
      <p className="ml-8 justify-self-end rounded-2xl rounded-br-md bg-raised px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground ring-1 ring-border">
        {text}
      </p>
    );
  }
  const sources = message.metadata ? contextSourcesLine(message.metadata.contextSources) : null;
  const conversationId = message.metadata?.conversationId;
  return (
    <article className="grid gap-2">
      {sources ? <p className="text-[0.75rem] text-faint">{sources}</p> : null}
      {text ? (
        <Markdown className="text-sm" onSeek={onSeek} durationSeconds={durationSeconds}>
          {text}
        </Markdown>
      ) : null}
      {!streaming && text ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <AiLabel note={incomplete ? "incomplete answer" : undefined} className="text-faint" />
            <div className="flex items-center gap-1">
              {incomplete && onRetry ? (
                <Button type="button" size="xs" variant="outline" onClick={onRetry}>
                  <RefreshIcon />
                  Retry
                </Button>
              ) : null}
              <SaveConceptButton concept={saveAs} size="xs" variant="ghost" />
            </div>
          </div>
          {conversationId && text.length > CHECK_MIN_CHARS && !incomplete ? (
            <CheckUnderstanding
              conversationId={conversationId}
              messageId={message.id}
              durationSeconds={durationSeconds}
              onSeek={onSeek}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** One MCQ about an answer, generated on request and graded on the server (Section 5.6.5). */
function CheckUnderstanding({
  conversationId,
  messageId,
  durationSeconds,
  onSeek,
}: {
  conversationId: string;
  messageId: string;
  durationSeconds: number;
  onSeek: (seconds: number) => void;
}) {
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; question: QuestionPublic }
  >({ kind: "idle" });

  const load = async () => {
    setState({ kind: "loading" });
    const response = await requestJson("/api/questions/check", CheckQuestionResponseSchema, {
      body: { conversationId, messageId },
    });
    setState(response.ok ? { kind: "ready", question: response.data.question } : { kind: "error", message: response.message });
  };

  if (state.kind === "ready") {
    return (
      <div className="animate-fade rounded-xl border bg-card p-4 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
        <p className="mb-3 text-[0.75rem] text-faint">Check my understanding · AI-generated question</p>
        <QuestionCard question={state.question} durationSeconds={durationSeconds} onSeek={onSeek} />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void load()}
        disabled={state.kind === "loading"}
      >
        {state.kind === "loading" ? <ProgressActivityIcon className="animate-spin motion-reduce:animate-none" /> : <FactCheckIcon />}
        Check my understanding
      </Button>
      {state.kind === "error" ? (
        <p role="alert" className="animate-fade text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
