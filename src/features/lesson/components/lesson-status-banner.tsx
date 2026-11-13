"use client";

import { HourglassTopIcon, ProgressActivityIcon, RefreshIcon, WarningIcon } from "@/components/icons";
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
      <div role="alert" className="grid gap-3 rounded-xl border border-margin/30 bg-margin/5 p-4">
        <p className="flex items-start gap-2.5 font-medium">
          <WarningIcon className="mt-0.5 size-4.5 shrink-0 text-margin" />
          We couldn&apos;t build this lesson.
        </p>
        <p className="text-sm text-muted-foreground">
          The video still plays. You can try again, or build the lesson from the video&apos;s transcript instead.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onRetryLesson} disabled={retrying}>
            <RefreshIcon />
            {retrying ? "Retrying…" : "Retry"}
          </Button>
          {transcriptAction}
        </div>
      </div>
    );
  }

  if (!isBuilding(data)) return null;

  if (stalled) {
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-card p-4">
        <p className="text-sm">This is taking longer than usual.</p>
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
    <div role="status" aria-live="polite" className="grid gap-2.5 rounded-xl border border-foreground/10 bg-card p-4">
      <p className="flex items-center gap-2.5 text-sm font-medium">
        {waitingForCapacity ? (
          <HourglassTopIcon className="size-4.5 text-muted-foreground" />
        ) : (
          <ProgressActivityIcon className="size-4.5 animate-spin text-muted-foreground motion-reduce:animate-none" />
        )}
        {waitingForCapacity
          ? "Waiting for free AI capacity… your lesson is queued."
          : outlined
            ? `Building notes — ${progress.chaptersReady} of ${progress.chaptersTotal} chapters`
            : "Watching the lecture…"}
      </p>
      {outlined ? (
        <div
          className="h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Chapters ready"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-primary transition-[width] duration-300 ease-(--ease-out)" style={{ width: `${percent}%` }} />
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {outlined
          ? "Ready chapters work now. The rest fill in as they're built."
          : "The video already plays. Chapters and notes appear here as soon as they're ready."}
      </p>
    </div>
  );
}
