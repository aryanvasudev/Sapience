"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, useState, type ReactNode } from "react";

import { CheckCircleIcon, CancelIcon, ProgressActivityIcon } from "@/components/icons";
import { MorphText } from "@/components/motion/morph-text";
import { Markdown } from "@/components/shared/markdown";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { AttemptResultSchema, type AttemptResult, type QuestionPublic } from "@/types/contracts";

const LETTERS = ["A", "B", "C", "D"];
const EASE = [0.22, 1, 0.36, 1] as const;

/** Short options (numbers, single terms) sit in a 2×2 grid; sentences get a full-width column. */
const COMPACT_MAX_CHARS = 24;

/**
 * One multiple-choice question, graded on the server (Section 5.7). The answer arrives only
 * after the student submits. Wording: "You got this one" / "Worth reviewing", never "mastered".
 */
export function QuestionCard({
  question,
  durationSeconds,
  onSeek,
  onResult,
  actions,
  className,
}: {
  question: QuestionPublic;
  durationSeconds: number;
  onSeek: (seconds: number) => void;
  onResult?: (result: AttemptResult, selectedIndex: number) => void;
  /** Shown after grading, e.g. Rewatch / Explain differently / Save / Continue. */
  actions?: (result: AttemptResult, selectedIndex: number) => ReactNode;
  className?: string;
}) {
  const name = useId();
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const compact = question.options.every((o) => o.length <= COMPACT_MAX_CHARS && !o.includes("\n"));

  const submit = async () => {
    if (selected === null || submitting) return;
    setSubmitting(true);
    setError(null);
    const response = await requestJson(`/api/questions/${question.id}/attempt`, AttemptResultSchema, {
      body: { selectedIndex: selected },
    });
    setSubmitting(false);
    if (!response.ok) {
      setError(response.message);
      return;
    }
    setResult(response.data);
    onResult?.(response.data, selected);
  };

  // The right/wrong mark pops in with a small spring; reduced motion gets a plain fade.
  const markIn = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
    : {
        initial: { opacity: 0, scale: 0.6 },
        animate: { opacity: 1, scale: 1 },
        transition: { type: "spring" as const, duration: 0.35, bounce: 0.25 },
      };

  return (
    <div className={cn("grid gap-4", className)}>
      <fieldset disabled={result !== null || submitting} className="grid min-w-0 gap-3">
        <legend className="mb-3 text-[0.9375rem] leading-relaxed text-pretty text-foreground">
          <Markdown inline>{question.prompt}</Markdown>
        </legend>
        <div className={cn("grid gap-2", compact && "grid-cols-2")}>
          {question.options.map((option, index) => {
            const picked = selected === index;
            const isCorrect = result?.correctIndex === index;
            const isWrongPick = result !== null && picked && !result.isCorrect;
            const isOther = result !== null && !isCorrect && !isWrongPick;
            return (
              <label
                key={index}
                className={cn(
                  "group/option flex min-h-11 min-w-0 cursor-pointer items-start gap-3 rounded-[10px] border bg-background px-3 py-2.5 text-sm",
                  "transition-[background-color,border-color,color,transform] duration-200 ease-(--ease-out)",
                  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                  result === null && !submitting && "active:scale-[0.98]",
                  result === null && !picked && "[@media(hover:hover)]:hover:border-foreground/20 [@media(hover:hover)]:hover:bg-muted/50",
                  result === null && picked && "border-brand/60 bg-brand/10",
                  isCorrect && "border-positive/45 bg-positive/10",
                  isWrongPick && "border-destructive/45 bg-destructive/10",
                  isOther && "text-faint",
                  result !== null && "cursor-default",
                )}
              >
                <input
                  type="radio"
                  name={name}
                  value={index}
                  checked={picked}
                  onChange={() => setSelected(index)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "mt-px flex size-5 shrink-0 items-center justify-center rounded-md border font-mono text-[0.6875rem] font-medium tabular-nums",
                    "transition-[background-color,border-color,color] duration-200 ease-(--ease-out)",
                    result === null && picked && "border-brand bg-brand text-brand-foreground",
                    result === null && !picked && "text-muted-foreground",
                    isCorrect && "border-positive/40 text-positive",
                    isWrongPick && "border-destructive/40 text-destructive",
                    isOther && "text-faint",
                  )}
                >
                  {LETTERS[index]}
                </span>
                <span className="min-w-0 flex-1 leading-relaxed">
                  <Markdown inline>{option}</Markdown>
                </span>
                {isCorrect ? (
                  <motion.span className="mt-px flex shrink-0" {...markIn}>
                    <CheckCircleIcon className="size-4.5 text-positive" aria-label="Correct answer" />
                  </motion.span>
                ) : null}
                {isWrongPick ? (
                  <motion.span className="mt-px flex shrink-0" {...markIn}>
                    <CancelIcon className="size-4.5 text-destructive" aria-label="Your answer" />
                  </motion.span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      {result === null ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void submit()} disabled={selected === null || submitting}>
            {submitting ? <ProgressActivityIcon className="animate-spin motion-reduce:animate-none" /> : null}
            <MorphText>{submitting ? "Checking…" : "Check answer"}</MorphText>
          </Button>
          {error ? (
            <p role="alert" className="animate-fade text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <motion.div
          role="status"
          className="grid gap-3"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE, delay: 0.08 }}
        >
          <p className="text-[0.9375rem] font-medium">{result.isCorrect ? "You got this one" : "Worth reviewing"}</p>
          <Markdown className="text-sm" onSeek={onSeek} durationSeconds={durationSeconds}>
            {result.explanation}
          </Markdown>
          {!result.isCorrect && result.misconception ? (
            <p className="border-l-2 border-destructive/50 pl-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">A common mix-up: </span>
              {result.misconception}
            </p>
          ) : null}
          {actions && selected !== null ? <div className="flex flex-wrap items-center gap-2 pt-1">{actions(result, selected)}</div> : null}
        </motion.div>
      )}
    </div>
  );
}
