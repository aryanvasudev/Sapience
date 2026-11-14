"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  ArrowForwardIcon,
  CheckCircleIcon,
  KeyboardDoubleArrowDownIcon,
  KeyboardDoubleArrowUpIcon,
  PlayArrowIcon,
  ProgressActivityIcon,
  QuizIcon,
  ReplayIcon,
  TrendingDownIcon,
} from "@/components/icons";
import { TimestampChip } from "@/components/shared/timestamp-chip";
import { Button } from "@/components/ui/button";
import { QUIZ_LEVEL_NAMES, type OutputLanguage, type QuizLevel } from "@/config/enums";
import { QuestionCard } from "@/features/lesson/components/question-card";
import { requestJson } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import {
  QuizAnswerResponseSchema,
  QuizSessionSchema,
  type AttemptResult,
  type ChapterPublic,
  type QuizAnswerResponse,
  type QuizSession,
  type TopicOutcomeName,
} from "@/types/contracts";

const OUTCOME: Record<TopicOutcomeName, { label: string; className: string }> = {
  solid: { label: "Solid", className: "border-positive/40 bg-positive/10 text-positive" },
  getting_there: { label: "Getting there", className: "border-brand/40 bg-brand/10 text-foreground" },
  rewatch: { label: "Rewatch this", className: "border-destructive/40 bg-destructive/10 text-destructive" },
};

const EASE = [0.22, 1, 0.36, 1] as const;

type Phase =
  | { kind: "pick" }
  | { kind: "loading"; session: QuizSession | null }
  | { kind: "question"; session: QuizSession }
  | { kind: "done"; session: QuizSession };

/**
 * "Check yourself": an adaptive quiz on one chapter or the whole lecture. A right answer makes the
 * next question on that topic harder; a wrong one brings an easier question on the same idea. The
 * next question is written while the student reads the explanation, so it's usually ready.
 */
export function QuizPanel({
  videoId,
  language,
  chapters,
  currentPosition,
  durationSeconds,
  onSeek,
  onWeakSpotsChanged,
  onReviseWeakSpots,
  preset,
}: {
  videoId: string;
  language: OutputLanguage;
  chapters: ChapterPublic[];
  currentPosition: number | null;
  durationSeconds: number;
  onSeek: (seconds: number) => void;
  /** A wrong answer adds a weak spot; a solid topic resolves some. */
  onWeakSpotsChanged: () => void;
  onReviseWeakSpots: () => void;
  /** Start straight away on this chapter (from "Quiz me on this"). Changing `key` restarts. */
  preset?: number | null;
}) {
  const ready = chapters.filter((c) => c.status === "ready" && c.segments.length > 0);
  const current = ready.find((c) => c.position === currentPosition) ?? ready[0] ?? null;
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState<QuizAnswerResponse | null>(null);
  const prefetch = useRef<Promise<QuizSession | null> | null>(null);

  const fetchNext = async (sessionId: string): Promise<QuizSession | null> => {
    const r = await requestJson(`/api/quiz/${sessionId}/next`, QuizSessionSchema, { body: {} });
    if (!r.ok) {
      setError(r.message);
      return null;
    }
    return r.data;
  };

  const start = async (chapterPosition?: number) => {
    setError(null);
    setAnswered(null);
    setPhase({ kind: "loading", session: null });
    const r = await requestJson(`/api/lessons/${videoId}/quiz`, QuizSessionSchema, {
      body: { language, ...(chapterPosition !== undefined ? { chapterPosition } : {}) },
    });
    if (!r.ok) {
      setError(r.message);
      setPhase({ kind: "pick" });
      return;
    }
    setPhase({ kind: "loading", session: r.data });
    const next = await fetchNext(r.data.sessionId);
    if (!next) return setPhase({ kind: "pick" });
    setPhase(next.status === "done" || !next.question ? { kind: "done", session: next } : { kind: "question", session: next });
  };

  // "Quiz me on this" opens the panel with a chapter preset (the parent remounts it with a new key).
  const presetReady = preset !== undefined && preset !== null && ready.some((c) => c.position === preset);
  const startPreset = useEffectEvent((position: number) => void start(position));
  useEffect(() => {
    if (!presetReady || preset === null || preset === undefined) return;
    const timer = window.setTimeout(() => startPreset(preset), 0);
    return () => window.clearTimeout(timer);
  }, [presetReady, preset]);

  const grade = async (selectedIndex: number) => {
    if (phase.kind !== "question" || !phase.session.question) return { ok: false as const, code: "bad_request", message: "No question." };
    const { sessionId, question } = { sessionId: phase.session.sessionId, question: phase.session.question };
    const r = await requestJson(`/api/quiz/${sessionId}/answer`, QuizAnswerResponseSchema, {
      body: { questionId: question.id, selectedIndex },
    });
    if (!r.ok) return r;
    setAnswered(r.data);
    if (!r.data.result.isCorrect || r.data.topicDone?.outcome === "solid") onWeakSpotsChanged();
    // Write the next question while the student reads the explanation.
    prefetch.current = r.data.session.status === "done" ? Promise.resolve(r.data.session) : fetchNext(sessionId);
    return { ok: true as const, data: r.data.result };
  };

  const goNext = async () => {
    if (phase.kind !== "question") return;
    const after = answered?.session ?? phase.session;
    setAnswered(null);
    setPhase({ kind: "loading", session: after });
    const next = await (prefetch.current ?? fetchNext(after.sessionId));
    prefetch.current = null;
    if (!next) return setPhase({ kind: "question", session: phase.session });
    setPhase(next.status === "done" || !next.question ? { kind: "done", session: next } : { kind: "question", session: next });
  };

  const finish = async () => {
    if (phase.kind !== "question" && phase.kind !== "loading") return;
    const id = phase.session?.sessionId;
    if (!id) return setPhase({ kind: "pick" });
    const r = await requestJson(`/api/quiz/${id}/finish`, QuizSessionSchema, { body: {} });
    prefetch.current = null;
    setAnswered(null);
    if (r.ok) setPhase(r.data.topics.length > 0 ? { kind: "done", session: r.data } : { kind: "pick" });
    else setError(r.message);
  };

  if (ready.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-5 text-sm leading-relaxed text-muted-foreground">
        The quiz opens once the first chapter&apos;s notes are ready.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {phase.kind === "pick" ? (
        <QuizPicker current={current} chapterCount={ready.length} onStart={(p) => void start(p)} />
      ) : phase.kind === "done" ? (
        <QuizSummary
          session={phase.session}
          chapters={chapters}
          onSeek={onSeek}
          onAgain={() => setPhase({ kind: "pick" })}
          onRevise={onReviseWeakSpots}
        />
      ) : (
        <div className="grid gap-4">
          {phase.session ? <QuizProgress session={answered?.session ?? phase.session} /> : null}
          {phase.kind === "loading" ? (
            <div role="status" className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground">
              <ProgressActivityIcon className="size-4.5 animate-spin motion-reduce:animate-none" />
              {phase.session ? "Writing your next question…" : "Setting up your quiz…"}
            </div>
          ) : phase.session.question ? (
            <QuizQuestionView
              key={phase.session.question.id}
              session={phase.session}
              answered={answered}
              durationSeconds={durationSeconds}
              onSeek={onSeek}
              grade={grade}
              onNext={() => void goNext()}
            />
          ) : null}
          {phase.session ? (
            <button
              type="button"
              onClick={() => void finish()}
              className="justify-self-start text-[0.8125rem] text-muted-foreground underline decoration-foreground/20 underline-offset-4 transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:text-foreground"
            >
              End quiz and see results
            </button>
          ) : null}
        </div>
      )}
      {error ? (
        <p role="alert" className="animate-fade text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function QuizPicker({
  current,
  chapterCount,
  onStart,
}: {
  current: ChapterPublic | null;
  chapterCount: number;
  onStart: (chapterPosition?: number) => void;
}) {
  const option =
    "group/opt grid w-full gap-1 rounded-[14px] border bg-card p-4 text-left transition-[border-color,background-color,transform] duration-150 ease-(--ease-out) active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [@media(hover:hover)]:hover:border-foreground/20 [@media(hover:hover)]:hover:bg-raised";
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <h3 className="flex items-center gap-2 text-[0.9375rem] font-medium">
          <QuizIcon className="size-4.5 text-brand" />
          Check yourself
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Questions adapt as you go. Get one right and the next is harder; miss one and you get an easier question on the same idea
          to clear it up. Misses become weak spots you can rewatch.
        </p>
      </div>
      <div className="grid gap-2">
        {current ? (
          <button type="button" className={option} onClick={() => onStart(current.position)}>
            <span className="flex items-center justify-between gap-3 text-sm font-medium">
              This chapter
              <ArrowForwardIcon className="size-4 text-faint transition-transform duration-150 ease-(--ease-out) group-hover/opt:translate-x-0.5" />
            </span>
            <span className="truncate text-[0.8125rem] text-muted-foreground">
              {current.position + 1}. {current.title} · up to 8 questions
            </span>
          </button>
        ) : null}
        <button type="button" className={option} onClick={() => onStart()}>
          <span className="flex items-center justify-between gap-3 text-sm font-medium">
            Whole lecture
            <ArrowForwardIcon className="size-4 text-faint transition-transform duration-150 ease-(--ease-out) group-hover/opt:translate-x-0.5" />
          </span>
          <span className="text-[0.8125rem] text-muted-foreground">
            {Math.min(6, chapterCount)} {Math.min(6, chapterCount) === 1 ? "topic" : "topics"}, your weak ones first · 2–4 questions each
          </span>
        </button>
      </div>
    </div>
  );
}

/** Topic n of m, and a four-step level meter. */
function QuizProgress({ session }: { session: QuizSession }) {
  const topic = session.topics[Math.min(session.topicIndex, session.topics.length - 1)];
  const level = session.question?.level ?? session.level;
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="min-w-0 truncate text-[0.8125rem] text-muted-foreground">
        {session.topics.length > 1 ? (
          <span className="font-mono text-[0.75rem] text-faint tabular-nums">
            {Math.min(session.topicIndex + 1, session.topics.length)}/{session.topics.length}{" "}
          </span>
        ) : null}
        {topic ? topic.title : null}
      </p>
      <LevelMeter level={level} />
    </div>
  );
}

export function LevelMeter({ level }: { level: QuizLevel }) {
  return (
    <span className="flex shrink-0 items-center gap-2" aria-label={`Level ${level} of 4: ${QUIZ_LEVEL_NAMES[level]}`}>
      <span aria-hidden className="flex items-end gap-0.5">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={cn("w-1 rounded-full transition-colors duration-200 ease-(--ease-out)", n <= level ? "bg-brand" : "bg-muted")}
            style={{ height: 4 + n * 3 }}
          />
        ))}
      </span>
      <span aria-hidden className="text-[0.75rem] text-muted-foreground">
        {QUIZ_LEVEL_NAMES[level]}
      </span>
    </span>
  );
}

function QuizQuestionView({
  session,
  answered,
  durationSeconds,
  onSeek,
  grade,
  onNext,
}: {
  session: QuizSession;
  answered: QuizAnswerResponse | null;
  durationSeconds: number;
  onSeek: (seconds: number) => void;
  grade: (selectedIndex: number) => Promise<{ ok: true; data: AttemptResult } | { ok: false; code: string; message: string }>;
  onNext: () => void;
}) {
  const reduce = useReducedMotion();
  const question = session.question;
  if (!question) return null;
  const nextLevel = answered?.session.level;
  const done = answered?.session.status === "done";
  return (
    <motion.div
      className="grid gap-3 rounded-2xl border bg-card p-4 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
    >
      {question.followUp ? (
        <p className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
          <KeyboardDoubleArrowDownIcon className="size-4 text-brand" />
          An easier one on the same idea
        </p>
      ) : null}
      <QuestionCard
        question={question}
        durationSeconds={durationSeconds}
        onSeek={onSeek}
        grade={grade}
        actions={(result) => (
          <>
            <Button type="button" size="sm" onClick={onNext}>
              {done ? "See results" : "Next question"}
              <ArrowForwardIcon />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onSeek(question.startSeconds);
              }}
            >
              <PlayArrowIcon />
              Rewatch this part
            </Button>
            <AnimatePresence>
              {answered && !done ? (
                <motion.span
                  key="hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex basis-full items-center gap-1.5 pt-1 text-[0.75rem] text-muted-foreground"
                >
                  {answered.topicDone ? (
                    <>
                      <CheckCircleIcon className="size-4 text-positive" />
                      Topic finished: {OUTCOME[answered.topicDone.outcome].label.toLowerCase()}. Next topic up.
                    </>
                  ) : result.isCorrect ? (
                    <>
                      <KeyboardDoubleArrowUpIcon className="size-4 text-brand" />
                      Next one is harder{nextLevel ? `: ${QUIZ_LEVEL_NAMES[nextLevel]}` : ""}.
                    </>
                  ) : (
                    <>
                      <TrendingDownIcon className="size-4 text-destructive" />
                      Saved as a weak spot. Next: an easier question on this idea.
                    </>
                  )}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </>
        )}
      />
    </motion.div>
  );
}

function QuizSummary({
  session,
  chapters,
  onSeek,
  onAgain,
  onRevise,
}: {
  session: QuizSession;
  chapters: ChapterPublic[];
  onSeek: (seconds: number) => void;
  onAgain: () => void;
  onRevise: () => void;
}) {
  const asked = session.topics.reduce((n, t) => n + t.asked, 0);
  const correct = session.topics.reduce((n, t) => n + t.correct, 0);
  const shaky = session.topics.filter((t) => t.outcome && t.outcome !== "solid");
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h3 className="text-[0.9375rem] font-medium">Quiz results</h3>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono tabular-nums">
            {correct}/{asked}
          </span>{" "}
          right across {session.topics.length} {session.topics.length === 1 ? "topic" : "topics"}.
        </p>
      </div>
      <ol className="grid gap-2">
        {session.topics.map((t) => {
          const chapter = chapters.find((c) => c.position === t.position);
          const outcome = t.outcome ? OUTCOME[t.outcome] : null;
          return (
            <li key={t.position} className="flex items-center gap-3 rounded-[10px] border bg-card px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{t.title}</p>
                <p className="text-[0.75rem] text-muted-foreground">
                  {t.correct}/{t.asked} right
                  {t.bestLevel > 0 ? ` · reached ${QUIZ_LEVEL_NAMES[t.bestLevel as QuizLevel]}` : ""}
                </p>
              </div>
              {chapter && t.outcome !== "solid" ? <TimestampChip seconds={chapter.startSeconds} onSeek={onSeek} label={t.title} /> : null}
              {outcome ? (
                <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full border px-2 text-[0.75rem]", outcome.className)}>
                  {outcome.label}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        {shaky.length > 0 ? (
          <Button type="button" size="sm" onClick={onRevise}>
            <ReplayIcon />
            Revise weak spots
          </Button>
        ) : null}
        <Button type="button" size="sm" variant={shaky.length > 0 ? "outline" : "default"} onClick={onAgain}>
          New quiz
        </Button>
      </div>
    </div>
  );
}
