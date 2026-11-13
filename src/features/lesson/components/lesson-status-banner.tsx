"use client";

import { HourglassTopIcon, ProgressActivityIcon, RefreshIcon, WarningIcon } from "@/components/icons";
import { MorphText } from "@/components/motion/morph-text";
import { Button } from "@/components/ui/button";
import type { LessonStatusResponse } from "@/types/contracts";

import { isBuilding } from "../hooks/use-lesson-status";

/**
 * Lesson-map status (Section 5.2, 10). Says what is happening and what still works; never an
 * error for a rate-limit wait. Renders nothing once the lesson is fully ready.
 */
export function LessonStatusBanner({
  data,
  stalled,
  onRetryLesson,
  onRefresh,
  retrying,
  transcriptAction,
}: {
  data: LessonStatusResponse;
  stalled: boolean;
  onRetryLesson: () => void;
  onRefresh: () => void;
  retrying: boolean;
  transcriptAction: React.ReactNode;
}) {
  const { status, progress, waitingForCapacity } = data;

  if (status === "failed") {
    return (
      <div role="alert" className="grid gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5">
        <p className="flex items-start gap-2.5 text-[0.9375rem] font-medium">
          <WarningIcon className="mt-px size-4.5 shrink-0 text-destructive" />
          We couldn&apos;t build this lesson.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The video still plays. You can try again, or build the lesson from the video&apos;s transcript instead.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" onClick={onRetryLesson} disabled={retrying}>
            {retrying ? <ProgressActivityIcon className="animate-spin motion-reduce:animate-none" /> : <RefreshIcon />}
            <MorphText>{retrying ? "Retrying…" : "Retry"}</MorphText>
          </Button>
          {transcriptAction}
        </div>
      </div>
    );
  }

  if (!isBuilding(data)) return null;

  if (stalled) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
      >
        <p className="flex items-center gap-2.5 text-sm">
          <HourglassTopIcon className="size-4.5 shrink-0 text-faint" />
          This is taking longer than usual.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
          <RefreshIcon />
          Check again
        </Button>
      </div>
    );
  }

  const outlined = progress.chaptersTotal > 0;
  const percent = outlined ? Math.round((progress.chaptersReady / progress.chaptersTotal) * 100) : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="grid gap-3 rounded-2xl border bg-card p-4 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
          {waitingForCapacity ? (
            <HourglassTopIcon className="size-4.5 shrink-0 text-faint" />
          ) : (
            <ProgressActivityIcon className="size-4.5 shrink-0 animate-spin text-faint motion-reduce:animate-none" />
          )}
          {waitingForCapacity
            ? "Waiting for free AI capacity… your lesson is queued."
            : outlined
              ? "Building notes"
              : "Watching the lecture…"}
        </p>
        {outlined && !waitingForCapacity ? (
          <span className="shrink-0 font-mono text-[0.75rem] text-muted-foreground tabular-nums">
            {progress.chaptersReady} of {progress.chaptersTotal} chapters
          </span>
        ) : null}
      </div>
      {outlined ? (
        <div
          className="h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Chapters ready"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-brand transition-[width] duration-300 ease-(--ease-out)" style={{ width: `${Math.max(percent, 2)}%` }} />
        </div>
      ) : null}
      <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
        {outlined
          ? "Ready chapters work now. The rest fill in as they're built."
          : "The video already plays. Chapters and notes appear here as soon as they're ready."}
      </p>
    </div>
  );
}
