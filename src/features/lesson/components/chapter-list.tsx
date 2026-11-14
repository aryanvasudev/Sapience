"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useId } from "react";

import { ProgressActivityIcon, RefreshIcon, SummarizeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChapterPublic, LessonStatusResponse } from "@/types/contracts";

type DiamondState = "open" | "correct" | "wrong";

/** The checkpoint diamond: the product's signature mark, used only for checkpoints. */
export function CheckpointDiamond({ state, className }: { state: DiamondState; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2.5 shrink-0 rotate-45 rounded-[2px] border transition-colors duration-200 ease-(--ease-out)",
        // Hollow until answered: open = brand outline, right = solid brand, worth reviewing = red.
        state === "open" && "border-brand bg-transparent",
        state === "correct" && "border-brand bg-brand",
        state === "wrong" && "border-margin bg-margin/30",
        className,
      )}
    />
  );
}

const diamondFor = (chapter: ChapterPublic, attempts: LessonStatusResponse["attempts"]): DiamondState => {
  const attempt = chapter.checkpoint ? attempts[chapter.checkpoint.id] : undefined;
  return attempt ? (attempt.isCorrect ? "correct" : "wrong") : "open";
};

/**
 * The slim chapter timeline under the player: one segment per chapter, the watched part filled,
 * a checkpoint diamond where each chapter ends and the playhead in yellow. Decorative: the
 * chapter list carries the same information for assistive tech, and the player has its own scrubber.
 */
export function ChapterTimeline({
  chapters,
  attempts,
  durationSeconds,
  time,
  currentPosition,
  playing,
  weakRanges = [],
  moments = [],
}: {
  chapters: ChapterPublic[];
  attempts: LessonStatusResponse["attempts"];
  durationSeconds: number;
  time: number;
  currentPosition: number | null;
  playing: boolean;
  /** Weak spots, tinted on the track. */
  weakRanges?: { startSeconds: number; endSeconds: number }[];
  /** Saved moments, as small ticks under the track. */
  moments?: number[];
}) {
  const current = chapters.find((c) => c.position === currentPosition) ?? null;
  const end = Math.max(durationSeconds, chapters[chapters.length - 1]?.endSeconds ?? 0, 1);
  // The clock ticks every 500 ms while playing; a matching linear glide keeps the playhead smooth.
  const glide = playing ? "transition-transform duration-500 ease-linear" : "";

  return (
    <div aria-hidden className="grid gap-2.5">
      <ol className="flex h-1.5 gap-1">
        {chapters.map((chapter) => {
          const length = Math.max(1, chapter.endSeconds - chapter.startSeconds);
          const watched = Math.min(1, Math.max(0, (time - chapter.startSeconds) / length));
          const state = diamondFor(chapter, attempts);
          const isCurrent = chapter.position === currentPosition;
          return (
            <li key={chapter.position} className="relative min-w-0 basis-0 rounded-full bg-muted" style={{ flexGrow: length }}>
              <span className="absolute inset-y-0 left-0 rounded-full bg-foreground/30" style={{ width: `${watched * 100}%` }} />
              {weakRanges.map((r) => {
                const from = Math.max(r.startSeconds, chapter.startSeconds);
                const to = Math.min(r.endSeconds, chapter.endSeconds);
                if (to <= from) return null;
                return (
                  <span
                    key={`w${r.startSeconds}`}
                    className="absolute inset-y-0 z-[1] rounded-full bg-destructive/55"
                    style={{ left: `${((from - chapter.startSeconds) / length) * 100}%`, width: `${((to - from) / length) * 100}%` }}
                  />
                );
              })}
              {moments
                .filter((m) => m >= chapter.startSeconds && m < chapter.endSeconds)
                .map((m) => (
                  <span
                    key={`m${m}`}
                    className="absolute top-full mt-1 size-1 -translate-x-1/2 rounded-full bg-foreground/45"
                    style={{ left: `${((m - chapter.startSeconds) / length) * 100}%` }}
                  />
                ))}
              {chapter.checkpoint ? (
                <CheckpointDiamond
                  state={state}
                  className={cn(
                    "absolute top-1/2 -right-[5px] z-[2] -translate-y-1/2 shadow-[0_0_0_3px_var(--background)]",
                    state === "open" && "border-brand/70 bg-background",
                  )}
                />
              ) : null}
              {isCurrent ? (
                <span className={cn("pointer-events-none absolute inset-x-0 -inset-y-1.5 z-[3]", glide)} style={{ transform: `translateX(${watched * 100}%)` }}>
                  <span className="block h-full w-[3px] -translate-x-1/2 rounded-full bg-brand shadow-[0_0_0_2px_var(--background)]" />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="flex items-center justify-between gap-3 text-[0.8125rem]">
        <span className="min-w-0 truncate">
          {current ? (
            <>
              <span className="text-faint">Chapter {current.position + 1} · </span>
              <span className="text-muted-foreground">{current.title}</span>
            </>
          ) : null}
        </span>
        <span className="shrink-0 font-mono text-[0.75rem] text-faint tabular-nums">
          <span className="text-muted-foreground">{formatTimestamp(time)}</span> / {formatTimestamp(end)}
        </span>
      </div>
    </div>
  );
}

export function ChapterList({
  chapters,
  attempts,
  currentPosition,
  selectedPosition,
  onSelect,
  onRetry,
  retrying,
  onOpenCheckpoint,
  onOpenRecap,
}: {
  chapters: ChapterPublic[];
  attempts: LessonStatusResponse["attempts"];
  currentPosition: number | null;
  selectedPosition: number | null;
  onSelect: (chapter: ChapterPublic) => void;
  onRetry: (position: number) => void;
  retrying: number | null;
  /** Set when checkpoints don't pause the video: unanswered ones can be taken from here any time. */
  onOpenCheckpoint?: (questionId: string) => void;
  /** Shown when the lesson has checkpoints: opens the end-of-lesson recap. */
  onOpenRecap?: () => void;
}) {
  // The list renders twice (beside the player on desktop, above the study panel on mobile), so each
  // copy gets its own layout group and the current-chapter surface never jumps between them.
  const group = useId();
  const reduce = useReducedMotion();

  return (
    <div className="grid gap-2">
      <LayoutGroup id={group}>
        <ol className="grid gap-0.5 rounded-2xl border bg-card p-1.5 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
          {chapters.map((chapter) => {
            const current = chapter.position === currentPosition;
            const selected = chapter.position === selectedPosition;
            const attempt = chapter.checkpoint ? attempts[chapter.checkpoint.id] : undefined;
            const diamond = diamondFor(chapter, attempts);
            const takeable = chapter.status === "ready" && chapter.checkpoint && !attempt && onOpenCheckpoint ? chapter.checkpoint : null;
            return (
              <li key={chapter.position} className="relative isolate">
                {current ? (
                  <motion.span
                    layoutId="current-chapter"
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-[10px] bg-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] ring-1 ring-border"
                    transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.34, bounce: 0.1 }}
                  />
                ) : null}
                <div className="flex items-center gap-1 pr-1.5">
                  <button
                    type="button"
                    onClick={() => onSelect(chapter)}
                    aria-current={current ? "true" : undefined}
                    aria-pressed={selected}
                    className={cn(
                      "group/chapter flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-[10px] py-2 pr-1 pl-2.5 text-left transition-colors duration-150 ease-(--ease-out)",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      !current && "[@media(hover:hover)]:hover:bg-muted/60",
                      selected && !current && "bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "w-5 shrink-0 text-right font-mono text-[0.75rem] tabular-nums transition-colors duration-150 ease-(--ease-out)",
                        current ? "text-brand-ink" : "text-faint",
                      )}
                    >
                      {chapter.position + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm transition-colors duration-150 ease-(--ease-out)",
                          current || selected ? "text-foreground" : "text-foreground/80",
                          current && "font-medium",
                        )}
                      >
                        {chapter.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.75rem] text-faint">
                        <span className="font-mono tabular-nums">
                          {formatTimestamp(chapter.startSeconds)}–{formatTimestamp(chapter.endSeconds)}
                        </span>
                        {chapter.status === "pending" ? " · building notes" : ""}
                        {chapter.status === "failed" ? " · couldn't build notes" : ""}
                      </span>
                    </span>
                    {chapter.status === "pending" ? (
                      <ProgressActivityIcon className="size-4 shrink-0 animate-spin text-faint motion-reduce:animate-none" />
                    ) : null}
                    {chapter.status === "ready" && chapter.checkpoint && !takeable ? (
                      <span className="flex size-7 shrink-0 items-center justify-center" title="Checkpoint question">
                        <CheckpointDiamond state={diamond} />
                        <span className="sr-only">
                          {attempt ? (attempt.isCorrect ? "Checkpoint answered correctly" : "Checkpoint worth reviewing") : "Has a checkpoint question"}
                        </span>
                      </span>
                    ) : null}
                  </button>
                  {takeable ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onOpenCheckpoint?.(takeable.id)}
                      aria-label={`Take the checkpoint question for chapter ${chapter.position + 1}`}
                      title="Take the checkpoint question"
                    >
                      <CheckpointDiamond state="open" />
                    </Button>
                  ) : null}
                  {chapter.status === "failed" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => onRetry(chapter.position)}
                      disabled={retrying === chapter.position}
                      aria-label={`Retry building notes for chapter ${chapter.position + 1}`}
                    >
                      <RefreshIcon />
                      Retry
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </LayoutGroup>
      {onOpenRecap ? (
        <Button type="button" variant="ghost" size="sm" className="justify-self-start text-muted-foreground" onClick={onOpenRecap}>
          <SummarizeIcon />
          Lesson recap
        </Button>
      ) : null}
    </div>
  );
}
