import Image from "next/image";
import Link from "next/link";

import { PlayCircleIcon } from "@/components/icons";
import { OUTPUT_LANGUAGE_NAMES, type OutputLanguage } from "@/config/enums";
import { formatDuration, formatTimestamp } from "@/lib/format";

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

/** One lecture in a list: thumbnail, title, channel and length, with watch progress when known. */
export function LessonRow({ item }: { item: LessonRowData }) {
  const pct =
    item.positionSeconds === undefined ? null : Math.min(100, Math.round((item.positionSeconds / item.durationSeconds) * 100));
  return (
    <Link
      href={`/app/lesson/${item.videoId}?lang=${item.language}`}
      className="flex items-center gap-4 p-3 transition-colors duration-150 ease-(--ease-out) focus-visible:-outline-offset-2 [@media(hover:hover)]:hover:bg-muted/60"
    >
      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-[6px] bg-muted sm:w-36">
        {item.thumbnailUrl ? (
          <Image src={item.thumbnailUrl} alt="" fill sizes="144px" className="object-cover" />
        ) : (
          <PlayCircleIcon className="absolute inset-0 m-auto size-4.5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {item.fixture ? (
          <span className="mb-1 inline-block rounded-md bg-highlight px-2 py-0.5 text-xs font-medium text-highlight-foreground">
            Test fixture
          </span>
        ) : null}
        <p className="line-clamp-2 font-medium">{item.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {item.channel ? `${item.channel}, ` : ""}
          {formatDuration(item.durationSeconds)}
          {item.showLanguage ? ` · ${OUTPUT_LANGUAGE_NAMES[item.language]}` : ""}
        </p>
        {pct !== null && item.positionSeconds !== undefined ? (
          <div className="mt-2 flex items-center gap-3">
            <div
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Watched"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-sapphire" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{formatTimestamp(item.positionSeconds)}</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
