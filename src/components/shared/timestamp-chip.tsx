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
    "inline-flex h-6 items-center rounded-md bg-highlight/70 px-1.5 align-baseline font-mono text-[0.8125rem] leading-none text-highlight-foreground tabular-nums dark:bg-highlight/85",
    onSeek && "transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:bg-highlight focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
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
