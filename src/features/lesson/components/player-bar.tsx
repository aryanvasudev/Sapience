"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import { useEffect, useId, useState, useTransition } from "react";

import { BookmarkAddIcon, CloseIcon, CoffeeIcon, PlayArrowIcon, SkipNextIcon, TrendingDownIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { PeerStrip } from "@/features/rooms/components/peer-strip";
import { formatTimestamp } from "@/lib/format";
import type { TimeRange } from "@/lib/weak-spots/aggregate";
import type { ChapterPublic } from "@/types/contracts";

/**
 * The slim row under the player timeline. Normally: save this moment, mark it as confusing, and
 * classmates on this lecture. While revising weak spots it shows where you are in that playlist;
 * during a break, the countdown. The pause check-in renders just below it.
 */
export function PlayerBar({
  videoId,
  chapters,
  durationSeconds,
  time,
  onSeek,
  onSaveMoment,
  onMarkConfusing,
  revise,
  onSkipRevise,
  onStopRevise,
  breakEndsAt,
  onEndBreak,
}: {
  videoId: string;
  chapters: ChapterPublic[];
  durationSeconds: number;
  time: number;
  onSeek: (seconds: number) => void;
  onSaveMoment: (label: string | null) => Promise<boolean>;
  onMarkConfusing: () => Promise<boolean>;
  revise: { ranges: TimeRange[]; index: number } | null;
  onSkipRevise: () => void;
  onStopRevise: () => void;
  breakEndsAt: number | null;
  onEndBreak: () => void;
}) {
  if (breakEndsAt !== null) return <BreakTimer endsAt={breakEndsAt} onEnd={onEndBreak} />;

  if (revise) {
    const range = revise.ranges[revise.index];
    const left = range ? Math.max(0, Math.round(range.endSeconds - time)) : 0;
    return (
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border border-destructive/30 bg-destructive/5 px-3 py-1.5">
        <TrendingDownIcon className="size-4 shrink-0 text-destructive" />
        <p className="min-w-0 flex-1 text-[0.8125rem]">
          Revising weak spots{" "}
          <span className="font-mono text-[0.75rem] text-muted-foreground tabular-nums">
            {revise.index + 1}/{revise.ranges.length}
          </span>
          {range ? (
            <span className="text-muted-foreground">
              {" "}
              · {formatTimestamp(range.startSeconds)}–{formatTimestamp(range.endSeconds)} · {left} s left in this part
            </span>
          ) : null}
        </p>
        <div className="flex items-center gap-1">
          <Button type="button" size="xs" variant="ghost" onClick={onSkipRevise}>
            <SkipNextIcon />
            {revise.index + 1 < revise.ranges.length ? "Next part" : "Finish"}
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={onStopRevise} aria-label="Stop revising">
            <CloseIcon />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-9 items-center gap-2">
      <SaveMomentButton time={time} onSave={onSaveMoment} />
      <MarkConfusingButton onMark={onMarkConfusing} />
      <div className="ml-auto min-w-0">
        <PeerStrip videoId={videoId} chapters={chapters} durationSeconds={durationSeconds} onSeek={onSeek} />
      </div>
    </div>
  );
}

function SaveMomentButton({ time, onSave }: { time: number; onSave: (label: string | null) => Promise<boolean> }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [at, setAt] = useState(0);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          // Pin the moment when the popover opens, not when Save is pressed.
          setAt(Math.floor(time));
          setLabel("");
          setError(false);
        }
        setOpen(next);
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <Button type="button" size="xs" variant="outline" aria-keyshortcuts="b">
          <BookmarkAddIcon />
          Save moment
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 grid w-72 gap-2.5 rounded-[14px] border bg-popover p-3 text-popover-foreground shadow-lg outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <form
            className="grid gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const ok = await onSave(label.trim() || null);
                if (ok) setOpen(false);
                else setError(true);
              });
            }}
          >
            <label htmlFor={id} className="text-sm">
              Save <span className="font-mono text-[0.8125rem] text-muted-foreground tabular-nums">{formatTimestamp(at)}</span> for later
            </label>
            <input
              id={id}
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={200}
              placeholder="Label (optional), e.g. the proof"
              className="h-9 w-full rounded-[10px] border bg-background px-3 text-sm outline-none placeholder:text-faint focus-visible:border-brand/50 focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_14%,transparent)]"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.75rem] text-faint">
                Quick save: <Kbd>B</Kbd>
              </span>
              <Button type="submit" size="sm" disabled={pending}>
                Save
              </Button>
            </div>
            {error ? (
              <p role="alert" className="text-[0.8125rem] text-destructive">
                Couldn&apos;t save. Try again.
              </p>
            ) : null}
          </form>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function MarkConfusingButton({ onMark }: { onMark: () => Promise<boolean> }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      className="text-muted-foreground"
      disabled={pending}
      onClick={() => startTransition(async () => void (await onMark()))}
    >
      <TrendingDownIcon />
      <span className="hidden sm:inline">Mark as confusing</span>
      <span className="sm:hidden">Confusing</span>
    </Button>
  );
}

function BreakTimer({ endsAt, onEnd }: { endsAt: number; onEnd: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const left = Math.max(0, Math.round((endsAt - now) / 1000));
  const over = left === 0;
  return (
    <div
      role="timer"
      aria-live={over ? "polite" : "off"}
      className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border border-brand/30 bg-brand/5 px-3 py-1.5"
    >
      <CoffeeIcon className="size-4 shrink-0 text-brand" />
      <p className="min-w-0 flex-1 text-[0.8125rem]">
        {over ? (
          "Break's over. Ready when you are."
        ) : (
          <>
            On a break · <span className="font-mono tabular-nums">{formatTimestamp(left)}</span> left. Stand up, drink some water, look away
            from the screen.
          </>
        )}
      </p>
      <Button type="button" size="xs" variant={over ? "default" : "ghost"} onClick={onEnd}>
        <PlayArrowIcon />
        {over ? "Resume" : "I'm back"}
      </Button>
    </div>
  );
}
