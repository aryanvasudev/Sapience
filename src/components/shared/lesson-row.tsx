import Image from "next/image";
import Link from "next/link";

import { PlayArrowIcon, PlayCircleIcon } from "@/components/icons";
import { OUTPUT_LANGUAGE_NAMES, type OutputLanguage } from "@/config/enums";
import { formatDuration, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

export type LessonRowData = {
  videoId: string;
  language: OutputLanguage;
  title: string;
  channel: string | null;
  durationSeconds: number;
  thumbnailUrl: string | null;
  /** Where the student stopped; omit for lessons they haven't opened. */
  positionSeconds?: number;
  fixture?: boolean;
  showLanguage?: boolean;
};

const href = (item: LessonRowData) => `/app/lesson/${item.videoId}?lang=${item.language}`;

function FixtureTag({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-[5px] bg-highlight px-1.5 text-[0.6875rem] font-medium text-highlight-foreground", className)}>
      Test fixture
    </span>
  );
}

function Thumb({ item, sizes, className }: { item: LessonRowData; sizes: string; className?: string }) {
  return (
    <div className={cn("relative aspect-video shrink-0 overflow-hidden bg-muted ring-1 ring-border ring-inset", className)}>
      {item.thumbnailUrl ? (
        <Image src={item.thumbnailUrl} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <PlayCircleIcon className="absolute inset-0 m-auto size-5 text-faint" />
      )}
    </div>
  );
}

/**
 * One lecture in a list: thumbnail, title, channel and length, with watch progress when known.
 * `prefetch` loads the whole lesson before the click; keep it to short lists (each costs a request).
 */
export function LessonRow({ item, prefetch }: { item: LessonRowData; prefetch?: boolean }) {
  const pct =
    item.positionSeconds === undefined ? null : Math.min(100, Math.round((item.positionSeconds / item.durationSeconds) * 100));
  return (
    <Link
      href={href(item)}
      prefetch={prefetch ? true : "auto"}
      className="group/row flex items-center gap-4 rounded-xl p-2.5 transition-colors duration-150 ease-(--ease-out) focus-visible:-outline-offset-2 [@media(hover:hover)]:hover:bg-raised/70"
    >
      <Thumb item={item} sizes="144px" className="w-28 rounded-lg sm:w-36" />
      <div className="min-w-0 flex-1">
        {item.fixture ? <FixtureTag className="mb-1.5" /> : null}
        <p className="line-clamp-2 text-[0.9375rem] leading-snug font-medium">{item.title}</p>
        <p className="mt-1 truncate text-[0.8125rem] text-muted-foreground">
          {[item.channel, formatDuration(item.durationSeconds), item.showLanguage ? OUTPUT_LANGUAGE_NAMES[item.language] : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {pct !== null && item.positionSeconds !== undefined ? (
          <div className="mt-2.5 flex items-center gap-3">
            <div
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Watched"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
            <span className="font-mono text-[0.75rem] text-muted-foreground tabular-nums">{formatTimestamp(item.positionSeconds)}</span>
          </div>
        ) : null}
      </div>
      <span
        aria-hidden
        className="hidden size-9 shrink-0 place-items-center rounded-full border bg-background text-muted-foreground opacity-0 transition-[opacity,color] duration-150 ease-(--ease-out) group-hover/row:opacity-100 group-hover/row:text-foreground group-focus-visible/row:opacity-100 sm:grid"
      >
        <PlayArrowIcon className="size-4.5" />
      </span>
    </Link>
  );
}

/** A lecture as a card in a grid: thumbnail with its length, then title and channel. */
export function LessonCard({ item }: { item: LessonRowData }) {
  return (
    <Link href={href(item)} className="group/card grid gap-3 rounded-xl outline-offset-4">
      <div className="relative">
        <Thumb item={item} sizes="(min-width: 1024px) 280px, 50vw" className="rounded-xl" />
        <span className="absolute right-2 bottom-2 rounded-[5px] bg-black/75 px-1.5 py-0.5 font-mono text-[0.6875rem] text-white tabular-nums backdrop-blur-sm">
          {formatTimestamp(item.durationSeconds)}
        </span>
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl bg-black/0 ring-1 ring-transparent transition-[background-color,box-shadow] duration-200 ease-(--ease-out) ring-inset group-hover/card:bg-black/10 group-hover/card:ring-foreground/20"
        />
      </div>
      <div className="min-w-0 px-0.5">
        {item.fixture ? <FixtureTag className="mb-1.5" /> : null}
        <p className="line-clamp-2 text-[0.9375rem] leading-snug font-medium">{item.title}</p>
        <p className="mt-1 truncate text-[0.8125rem] text-muted-foreground">
          {[item.channel, item.showLanguage ? OUTPUT_LANGUAGE_NAMES[item.language] : null].filter(Boolean).join(" · ") ||
            formatDuration(item.durationSeconds)}
        </p>
      </div>
    </Link>
  );
}
