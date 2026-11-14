"use client";

import { useState, useTransition } from "react";

import { CheckIcon, PlayArrowIcon, QuizIcon } from "@/components/icons";
import { TimestampChip } from "@/components/shared/timestamp-chip";
import { Button } from "@/components/ui/button";
import type { WeakSpotSource } from "@/config/enums";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { checkpointRange, revisionPlaylist, SOURCE_LABEL, totalSeconds, type TimeRange, type WeakSpot, type WeakTopic } from "@/lib/weak-spots/aggregate";
import type { ChapterPublic } from "@/types/contracts";

import { resolveWeakSpots } from "./actions";

const SOURCE_ORDER: WeakSpotSource[] = ["manual", "checkpoint", "quiz", "doubt"];

const minutes = (seconds: number) => (seconds < 60 ? `${Math.max(1, Math.round(seconds))} s` : `${Math.round(seconds / 60)} min`);

/**
 * Weak topics for this lecture, worst first, built from wrong checkpoints and quiz answers, doubts
 * raised while paused, and the student's own marks. Each one lists the exact parts to rewatch, so
 * revising takes minutes instead of the whole lecture.
 */
export function WeakSpotsPanel({
  videoId,
  topics,
  chapters,
  durationSeconds,
  onSeek,
  onRevise,
  onQuiz,
  onResolved,
}: {
  videoId: string;
  topics: WeakTopic[];
  chapters: ChapterPublic[];
  durationSeconds: number;
  onSeek: (seconds: number) => void;
  /** Play these ranges back to back. */
  onRevise: (ranges: TimeRange[]) => void;
  onQuiz: (chapterPosition: number) => void;
  onResolved: (spots: WeakSpot[]) => void;
}) {
  if (topics.length === 0) {
    return (
      <div className="grid gap-2 rounded-2xl border border-dashed p-5 text-sm leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">No weak spots yet</p>
        <p>
          Parts of the lecture you struggle with collect here, with timestamps: checkpoints and quiz questions you miss, doubts you
          raise when you pause, and anything you mark as confusing under the video. Then you can rewatch just those parts.
        </p>
      </div>
    );
  }

  const playlist = revisionPlaylist(topics);
  const total = totalSeconds(playlist);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {topics.length} weak {topics.length === 1 ? "topic" : "topics"}
          </p>
          <p className="text-[0.8125rem] text-muted-foreground">
            About {minutes(total)} to rewatch, instead of {minutes(durationSeconds)} for the whole lecture.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => onRevise(playlist)}>
          <PlayArrowIcon />
          Revise all
        </Button>
      </div>

      <ol className="grid gap-2" aria-label="Weak topics">
        {topics.map((topic) => (
          <TopicItem
            key={topic.key}
            videoId={videoId}
            topic={topic}
            chapter={chapters.find((c) => c.position === topic.chapterPosition) ?? null}
            onSeek={onSeek}
            onRevise={onRevise}
            onQuiz={onQuiz}
            onResolved={onResolved}
          />
        ))}
      </ol>
    </div>
  );
}

function TopicItem({
  videoId,
  topic,
  chapter,
  onSeek,
  onRevise,
  onQuiz,
  onResolved,
}: {
  videoId: string;
  topic: WeakTopic;
  chapter: ChapterPublic | null;
  onSeek: (seconds: number) => void;
  onRevise: (ranges: TimeRange[]) => void;
  onQuiz: (chapterPosition: number) => void;
  onResolved: (spots: WeakSpot[]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const strength = Math.min(3, Math.ceil(topic.score / 2));

  const resolve = () =>
    startTransition(async () => {
      setError(false);
      const checkpoint =
        topic.sources.checkpoint && chapter?.checkpoint && topic.chapterPosition !== null
          ? { chapterPosition: topic.chapterPosition, label: chapter.checkpoint.concept.slice(0, 200), ...checkpointRange(chapter) }
          : undefined;
      const r = await resolveWeakSpots({ videoId, spotIds: topic.spotIds, checkpoint });
      if (r.ok) onResolved(r.spots);
      else setError(true);
    });

  return (
    <li className="grid gap-3 rounded-[14px] border bg-card p-3.5 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
      <div className="flex items-start gap-3">
        <span
          aria-label={`Weakness ${strength} of 3`}
          className="mt-1 flex shrink-0 items-end gap-0.5"
        >
          {[1, 2, 3].map((n) => (
            <span key={n} aria-hidden className={cn("w-1 rounded-full", n <= strength ? "bg-destructive/80" : "bg-muted")} style={{ height: 3 + n * 3 }} />
          ))}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {topic.chapterPosition !== null ? <span className="text-faint">{topic.chapterPosition + 1}. </span> : null}
            {topic.title}
          </p>
          {topic.labels.length > 0 ? <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{topic.labels.join(" · ")}</p> : null}
          <p className="mt-1.5 flex flex-wrap gap-1">
            {SOURCE_ORDER.filter((s) => topic.sources[s]).map((s) => (
              <span key={s} className="inline-flex h-5 items-center gap-1 rounded-[5px] border px-1.5 text-[0.6875rem] text-muted-foreground">
                {SOURCE_LABEL[s]}
                {(topic.sources[s] ?? 0) > 1 ? <span className="font-mono tabular-nums">×{topic.sources[s]}</span> : null}
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {topic.ranges.slice(0, 6).map((r) => (
          <span key={`${r.startSeconds}-${r.endSeconds}`} className="inline-flex items-center gap-1">
            <TimestampChip seconds={r.startSeconds} onSeek={onSeek} label={`${topic.title}, until ${formatTimestamp(r.endSeconds)}`} />
            <span className="font-mono text-[0.6875rem] text-faint tabular-nums">–{formatTimestamp(r.endSeconds)}</span>
          </span>
        ))}
        {topic.ranges.length > 6 ? <span className="text-[0.75rem] text-faint">+{topic.ranges.length - 6} more</span> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="xs" variant="outline" onClick={() => onRevise(topic.ranges)}>
          <PlayArrowIcon />
          Rewatch
        </Button>
        {topic.chapterPosition !== null && chapter?.status === "ready" ? (
          <Button type="button" size="xs" variant="outline" onClick={() => onQuiz(topic.chapterPosition ?? 0)}>
            <QuizIcon />
            Quiz me on this
          </Button>
        ) : null}
        <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={resolve} className="ml-auto text-muted-foreground">
          <CheckIcon />
          Got it now
        </Button>
      </div>
      {error ? (
        <p role="alert" className="animate-fade text-[0.8125rem] text-destructive">
          Couldn&apos;t update that. Try again.
        </p>
      ) : null}
    </li>
  );
}
