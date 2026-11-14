"use client";

import {
  CheckCircleIcon,
  CheckIcon,
  HourglassTopIcon,
  PlayCircleIcon,
  ProgressActivityIcon,
  WarningIcon,
} from "@/components/icons";
import { lessonJourney, type JourneyInput, type JourneyStep, type JourneyStepId, type JourneyTone, type StepState } from "@/lib/lessons/journey";
import { cn } from "@/lib/utils";

const STATE_NAMES: Record<StepState, string> = { done: "done", active: "in progress", upcoming: "not started", failed: "needs attention" };

function ToneIcon({ tone }: { tone: JourneyTone }) {
  const className = "size-4.5 shrink-0";
  switch (tone) {
    case "working":
      return <ProgressActivityIcon className={cn(className, "animate-spin text-brand-ink motion-reduce:animate-none")} />;
    case "waiting":
      return <HourglassTopIcon className={cn(className, "text-faint")} />;
    case "failed":
      return <WarningIcon className={cn(className, "text-destructive")} />;
    case "done":
      return <CheckCircleIcon className={cn(className, "text-brand-ink")} />;
    default:
      return <PlayCircleIcon className={cn(className, "text-faint")} />;
  }
}

/** One step's bar: full when done, filled to its fraction when active, sweeping when length is unknown. */
function StepBar({ step }: { step: Pick<JourneyStep, "state" | "fraction"> }) {
  const indeterminate = step.state === "active" && step.fraction === null;
  const fill = step.state === "done" ? 1 : (step.fraction ?? 0);
  return (
    <div className="relative h-1 overflow-hidden rounded-full bg-muted">
      {indeterminate ? (
        <div className="absolute inset-y-0 left-0 w-2/5 animate-indeterminate rounded-full bg-brand" />
      ) : (
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-(--ease-out)",
            step.state === "failed" ? "bg-destructive" : "bg-brand",
          )}
          // An active step with nothing done yet still shows a sliver, so "started" reads as started.
          style={{ width: `${step.state === "active" ? Math.max(fill * 100, 6) : fill * 100}%` }}
        />
      )}
    </div>
  );
}

/**
 * The lesson journey card (under the lesson title): what is happening now, then six steps from
 * "video checked" to "recap seen". `action` holds buttons for a failed or stalled build.
 */
export function LessonJourney({
  input,
  action,
  onStep,
}: {
  input: JourneyInput;
  action?: React.ReactNode;
  /** Steps that do something when pressed (e.g. open the recap). */
  onStep?: Partial<Record<JourneyStepId, () => void>>;
}) {
  const { steps, headline, hint, tone, overall } = lessonJourney(input);
  return (
    <section
      aria-label="Lesson progress"
      className={cn(
        "grid gap-4 rounded-2xl border bg-card p-4 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]",
        tone === "failed" && "border-destructive/30",
      )}
    >
      <div className="grid gap-1" role="status" aria-live="polite">
        <p className="flex min-w-0 items-start gap-2.5 text-sm font-medium">
          <span className="mt-px">
            <ToneIcon tone={tone} />
          </span>
          <span className="min-w-0 text-pretty">{headline}</span>
        </p>
        {hint ? <p className="pl-7 text-[0.8125rem] leading-relaxed text-muted-foreground">{hint}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2 pl-7">{action}</div> : null}

      <ol className="grid grid-cols-6 gap-1.5" aria-label={`Steps, ${Math.round(overall * 100)}% of the way through`}>
        {steps.map((step) => {
          const press = step.state === "active" ? onStep?.[step.id] : undefined;
          const body = (
            <>
              <StepBar step={step} />
              <span
                className={cn(
                  "mt-2 block truncate text-[0.6875rem] font-medium sm:text-[0.75rem]",
                  step.state === "active" ? "text-foreground" : step.state === "failed" ? "text-destructive" : step.state === "done" ? "text-muted-foreground" : "text-faint",
                )}
              >
                <span className="sm:hidden">{step.shortLabel}</span>
                <span className="hidden sm:inline">{step.label}</span>
              </span>
              <span
                className={cn(
                  "block truncate font-mono text-[0.6875rem] tabular-nums",
                  press ? "text-brand-ink underline decoration-brand-ink/40 underline-offset-2" : "text-faint",
                )}
              >
                {step.detail}
              </span>
              <span className="sr-only">, {STATE_NAMES[step.state]}</span>
            </>
          );
          return (
            <li key={step.id} className="min-w-0" aria-current={step.state === "active" ? "step" : undefined}>
              {press ? (
                <button
                  type="button"
                  onClick={press}
                  className="block w-full rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {body}
                </button>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The same rail with nothing known yet: shown while the lesson page loads. */
export function LessonJourneySkeleton() {
  const labels = ["Video", "Analysis", "Notes", "Watch", "Checkpoints", "Recap"];
  return (
    <section aria-label="Lesson progress" className="grid gap-4 rounded-2xl border bg-card p-4">
      <p role="status" className="flex items-center gap-2.5 text-sm font-medium">
        <ToneIcon tone="working" />
        Opening your lesson…
      </p>
      <ol className="grid grid-cols-6 gap-1.5" aria-hidden>
        {labels.map((label, i) => (
          <li key={label} className="min-w-0">
            <StepBar step={{ state: i === 0 ? "done" : i === 1 ? "active" : "upcoming", fraction: i === 1 ? null : 0 }} />
            <span className="mt-2 block truncate text-[0.6875rem] font-medium text-faint sm:text-[0.75rem]">{label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export type ListStep = { label: string; detail?: string; state: StepState };

/** A short vertical checklist for one request (the paste box, "Build this lesson"). */
export function StepList({ steps, className }: { steps: ListStep[]; className?: string }) {
  return (
    <ol role="status" aria-live="polite" className={cn("grid gap-2", className)}>
      {steps.map((step) => (
        <li key={step.label} className="flex items-start gap-2.5 text-sm">
          <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
            {step.state === "done" ? (
              <CheckIcon className="size-4 text-brand-ink" />
            ) : step.state === "active" ? (
              <ProgressActivityIcon className="size-4 animate-spin text-brand-ink motion-reduce:animate-none" />
            ) : step.state === "failed" ? (
              <WarningIcon className="size-4 text-destructive" />
            ) : (
              <span className="size-1.5 rounded-full bg-faint/60" />
            )}
          </span>
          <span className="grid min-w-0 gap-0.5">
            <span
              className={cn(
                step.state === "active" ? "font-medium text-foreground" : step.state === "upcoming" ? "text-faint" : "text-muted-foreground",
              )}
            >
              {step.label}
              <span className="sr-only">, {STATE_NAMES[step.state]}</span>
            </span>
            {step.detail && step.state === "active" ? (
              <span className="animate-fade text-[0.8125rem] text-muted-foreground">{step.detail}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
