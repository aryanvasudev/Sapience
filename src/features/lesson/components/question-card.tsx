"use client";

import { useId, useState, type ReactNode } from "react";

import { CheckCircleIcon, CancelIcon, ProgressActivityIcon } from "@/components/icons";
import { Markdown } from "@/components/shared/markdown";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { AttemptResultSchema, type AttemptResult, type QuestionPublic } from "@/types/contracts";

const LETTERS = ["A", "B", "C", "D"];

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
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className={cn("grid gap-4", className)}>
      <fieldset disabled={result !== null || submitting} className="grid gap-3">
        <legend className="mb-3 font-serif text-[1.0625rem] leading-snug font-medium text-pretty">
          <Markdown inline>{question.prompt}</Markdown>
        </legend>
        {question.options.map((option, index) => {
          const isCorrect = result?.correctIndex === index;
          const isWrongPick = result !== null && selected === index && !result.isCorrect;
          return (
            <label
              key={index}
              className={cn(
                "group/option flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors duration-150",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                result === null && "border-foreground/12 [@media(hover:hover)]:hover:border-foreground/30",
                result === null && selected === index && "border-foreground/60 bg-accent",
                isCorrect && "border-foreground/40 bg-highlight/45 dark:bg-highlight/20",
                isWrongPick && "border-margin/70 bg-margin/8",
                result !== null && !isCorrect && !isWrongPick && "border-foreground/8 text-muted-foreground",
                result !== null && "cursor-default",
              )}
            >
              <input
                type="radio"
                name={name}
                value={index}
                checked={selected === index}
                onChange={() => setSelected(index)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "mt-px flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.6875rem] font-medium tabular-nums",
                  selected === index && result === null ? "border-foreground bg-foreground text-background" : "border-foreground/20",
                )}
              >
                {LETTERS[index]}
              </span>
              <span className="min-w-0 flex-1 leading-relaxed">
                <Markdown inline>{option}</Markdown>
              </span>
              {isCorrect ? <CheckCircleIcon className="size-4.5 shrink-0 text-foreground" aria-label="Correct answer" /> : null}
              {isWrongPick ? <CancelIcon className="size-4.5 shrink-0 text-margin" aria-label="Your answer" /> : null}
            </label>
          );
        })}
      </fieldset>

      {result === null ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void submit()} disabled={selected === null || submitting}>
            {submitting ? <ProgressActivityIcon className="animate-spin motion-reduce:animate-none" /> : null}
            Check answer
          </Button>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div role="status" className="grid gap-3">
          <p className="font-serif text-lg font-medium">{result.isCorrect ? "You got this one" : "Worth reviewing"}</p>
          <Markdown className="text-sm" onSeek={onSeek} durationSeconds={durationSeconds}>
            {result.explanation}
          </Markdown>
          {!result.isCorrect && result.misconception ? (
            <p className="border-l-2 border-margin/60 pl-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">A common mix-up: </span>
              {result.misconception}
            </p>
          ) : null}
          {actions && selected !== null ? <div className="flex flex-wrap gap-2 pt-1">{actions(result, selected)}</div> : null}
        </div>
      )}
    </div>
  );
}
