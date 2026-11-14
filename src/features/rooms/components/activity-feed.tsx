import { timeAgo, type ActivityItem } from "@/lib/rooms/progress";

/** Joins, new goals and ticks, newest first. Server-rendered from the room snapshot. */
export function ActivityFeed({ items, now }: { items: ActivityItem[]; now: number }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
  return (
    <ol className="relative grid gap-3.5 border-l pl-4" aria-label="Recent activity">
      {items.map((item, i) => (
        <li key={`${item.kind}-${item.at}-${i}`} className="relative grid gap-0.5">
          <span
            aria-hidden
            className={
              item.kind === "goal_done"
                ? "absolute top-1.5 -left-[1.3125rem] size-2 rounded-full bg-brand shadow-[0_0_0_3px_var(--background)]"
                : "absolute top-1.5 -left-[1.3125rem] size-2 rounded-full bg-foreground/25 shadow-[0_0_0_3px_var(--background)]"
            }
          />
          <p className="text-[0.8125rem] leading-snug text-pretty">
            <span className="font-medium">{item.name}</span>{" "}
            <span className="text-muted-foreground">
              {item.kind === "joined" ? "joined the room" : item.kind === "goal_added" ? "added a goal:" : "finished"}
            </span>
            {item.kind !== "joined" ? <> {item.goalTitle}</> : null}
          </p>
          <time dateTime={item.at} className="text-xs text-faint" suppressHydrationWarning>
            {timeAgo(item.at, now)}
          </time>
        </li>
      ))}
    </ol>
  );
}
