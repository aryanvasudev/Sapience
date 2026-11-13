"use client";

import { ProgressActivityIcon, RefreshIcon, SummarizeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChapterPublic, LessonStatusResponse } from "@/types/contracts";

/** The checkpoint diamond: the product's signature mark, used only for checkpoints. */
export function CheckpointDiamond({ state, className }: { state: "open" | "correct" | "wrong"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2.5 shrink-0 rotate-45 rounded-[2px] border",
        // Hollow until answered: open = sapphire outline, right = solid sapphire, worth reviewing = red tint.
        state === "open" && "border-sapphire bg-transparent",
        state === "correct" && "border-sapphire bg-sapphire",
        state === "wrong" && "border-margin bg-margin/25",
        className,
      )}
    />
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
  return (
    <div className="grid gap-2">
      <ol className="divide-y divide-foreground/8 overflow-hidden rounded-xl border border-foreground/10 bg-card">
        {chapters.map((chapter) => {
          const current = chapter.position === currentPosition;
          const attempt = chapter.checkpoint ? attempts[chapter.checkpoint.id] : undefined;
          const diamond = attempt ? (attempt.isCorrect ? "correct" : "wrong") : "open";
          const takeable = chapter.status === "ready" && chapter.checkpoint && !attempt && onOpenCheckpoint ? chapter.checkpoint : null;
          return (
            <li key={chapter.position} className="relative">
              {current ? <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" /> : null}
              <div className="flex items-center gap-2 pr-2">
                <button
                  type="button"
                  onClick={() => onSelect(chapter)}
                  aria-current={current ? "true" : undefined}
                  aria-pressed={chapter.position === selectedPosition}
                  className={cn(
                    "flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left transition-colors duration-150",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                    "[@media(hover:hover)]:hover:bg-muted/60",
                    chapter.position === selectedPosition && "bg-accent",
                  )}
                >
                  <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{chapter.position + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", current ? "font-medium" : "")}>{chapter.title}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatTimestamp(chapter.startSeconds)}–{formatTimestamp(chapter.endSeconds)}
                      {chapter.status === "pending" ? " · building notes" : ""}
                      {chapter.status === "failed" ? " · couldn't build notes" : ""}
                    </span>
                  </span>
                  {chapter.status === "pending" ? (
                    <ProgressActivityIcon className="size-4.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />
                  ) : null}
                  {chapter.status === "ready" && chapter.checkpoint && !takeable ? (
                    <span className="flex size-6 shrink-0 items-center justify-center" title="Checkpoint question">
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
      {onOpenRecap ? (
        <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={onOpenRecap}>
          <SummarizeIcon />
          Lesson recap
        </Button>
      ) : null}
    </div>
  );
}
