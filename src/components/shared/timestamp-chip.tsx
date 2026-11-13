"use client";

import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A seekable time reference. Every timestamp in the lesson screen is one of these (Section 11). */
export function TimestampChip({
  seconds,
  onSeek,
  label,
  className,
}: {
  seconds: number;
  onSeek?: (seconds: number) => void;
  /** Accessible context, e.g. the key moment's label. */
  label?: string;
  className?: string;
}) {
  const text = formatTimestamp(seconds);
  const classes = cn(
    "inline-flex h-5 shrink-0 items-center rounded-[5px] border bg-surface px-1.5 align-baseline font-mono text-[0.75rem] leading-none text-muted-foreground tabular-nums",
    onSeek &&
      "cursor-pointer transition-[background-color,border-color,color] duration-150 ease-(--ease-out) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring [@media(hover:hover)]:hover:border-foreground/20 [@media(hover:hover)]:hover:bg-raised [@media(hover:hover)]:hover:text-foreground",
    className,
  );
  if (!onSeek) return <span className={classes}>{text}</span>;
  return (
    <button
      type="button"
      className={classes}
      onClick={() => onSeek(seconds)}
      aria-label={label ? `Play from ${text}: ${label}` : `Play from ${text}`}
    >
      {text}
    </button>
  );
}
