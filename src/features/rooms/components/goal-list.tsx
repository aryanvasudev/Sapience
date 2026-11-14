"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { CheckIcon, DeleteIcon, EventIcon, KeyboardArrowDownIcon, PlayCircleIcon, TargetIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatTimestamp } from "@/lib/format";
import { lectureDone, watchedFraction } from "@/lib/rooms/progress";
import type { RoomGoal, RoomMember } from "@/lib/rooms/service";
import { cn } from "@/lib/utils";

import { deleteGoal, toggleGoalCheck } from "../actions";
import { MemberAvatar } from "./room-ui";

/** Did this member finish this goal (ticked it, or watched 90% of its lecture)? */
function memberDone(goal: RoomGoal, userId: string): boolean {
  if (goal.checks.some((c) => c.userId === userId)) return true;
  const p = goal.progress[userId];
  return Boolean(goal.video && p && lectureDone(p.furthestSeconds, goal.video.durationSeconds));
}

function formatDueDate(dueAt: string, now: number): { text: string; overdue: boolean } {
  const due = new Date(dueAt);
  const days = Math.round((new Date(due).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000);
  const time = due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const showTime = !(due.getHours() === 23 && due.getMinutes() === 59);
  const day =
    days === 0 ? "today" : days === 1 ? "tomorrow" : days === -1 ? "yesterday" : due.toLocaleDateString(undefined, { weekday: days > 0 && days < 7 ? "short" : undefined, day: "numeric", month: "short" });
  return { text: `Due ${day}${showTime ? `, ${time}` : ""}`, overdue: due.getTime() < now };
}

export function GoalList({ goals, members, me, now }: { goals: RoomGoal[]; members: RoomMember[]; me: string; now: number }) {
  if (goals.length === 0) {
    return (
      <div className="grid gap-1 rounded-2xl border border-dashed p-6">
        <p className="text-[0.9375rem] font-medium">No goals yet</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Add a lecture everyone should finish by a date, or anything else the room is working towards. Progress shows up here as people watch.
        </p>
      </div>
    );
  }
  return (
    <ol className="grid gap-3" aria-label="Goals">
      {goals.map((goal) => (
        <GoalItem key={goal.id} goal={goal} members={members} me={me} now={now} />
      ))}
    </ol>
  );
}

function GoalItem({ goal, members, me, now }: { goal: RoomGoal; members: RoomMember[]; me: string; now: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ticked = goal.checks.some((c) => c.userId === me);
  const mine = goal.progress[me];
  const autoDone = Boolean(goal.video && mine && lectureDone(mine.furthestSeconds, goal.video.durationSeconds));
  const done = ticked || autoDone;
  const doneCount = members.filter((m) => memberDone(goal, m.userId)).length;
  const due = goal.dueAt ? formatDueDate(goal.dueAt, now) : null;

  const toggle = () =>
    startTransition(async () => {
      setError(null);
      const result = await toggleGoalCheck({ goalId: goal.id, done: !ticked });
      if (!result.ok) setError(result.message);
    });

  return (
    <li className="rounded-2xl border bg-card dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Mark “${goal.title}” as not done` : `Mark “${goal.title}” as done`}
          disabled={pending || (autoDone && !ticked)}
          onClick={toggle}
          title={autoDone && !ticked ? "Done: you've watched 90% of this lecture" : undefined}
          className={cn(
            "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border transition-[background-color,border-color,transform] duration-150 ease-(--ease-out) outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.92] disabled:cursor-default",
            done ? "border-brand bg-brand text-brand-foreground" : "border-foreground/25 [@media(hover:hover)]:hover:border-foreground/50",
          )}
        >
          {done ? <CheckIcon className="size-3.5 animate-fade" /> : null}
        </button>
        <div className="grid min-w-0 flex-1 gap-1.5">
          <p className={cn("text-[0.9375rem] leading-snug font-medium text-pretty", done && "text-muted-foreground")}>{goal.title}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted-foreground">
            {goal.video ? (
              <Link
                href={`/app/lesson/${goal.video.id}`}
                className="inline-flex min-w-0 items-center gap-1 underline decoration-foreground/20 underline-offset-4 transition-[text-decoration-color,color] duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:text-foreground [@media(hover:hover)]:hover:decoration-foreground/60"
              >
                <PlayCircleIcon className="size-4 shrink-0" />
                <span className="truncate">
                  {mine && !autoDone && mine.furthestSeconds > 0 ? `Continue from ${formatTimestamp(mine.lastPositionSeconds)}` : "Open lecture"}
                </span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1">
                <TargetIcon className="size-4" />
                Goal
              </span>
            )}
            {due ? (
              <span className={cn("inline-flex items-center gap-1", due.overdue && !done && "text-destructive")}>
                <EventIcon className="size-4" />
                {/* Local time: the server renders in its own time zone, the browser corrects it. */}
                <span suppressHydrationWarning>{due.text}</span>
              </span>
            ) : null}
          </div>
        </div>
        {goal.canDelete ? (
          confirmDelete ? (
            <span className="flex shrink-0 animate-fade gap-1">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteGoal({ goalId: goal.id });
                    if (!result.ok) setError(result.message);
                    setConfirmDelete(false);
                  })
                }
              >
                Delete
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="-mt-0.5 -mr-1 shrink-0 text-faint [@media(hover:hover)]:hover:text-foreground"
              aria-label={`Delete goal “${goal.title}”`}
              onClick={() => setConfirmDelete(true)}
            >
              <DeleteIcon />
            </Button>
          )
        ) : null}
      </div>

      <Collapsible>
        <CollapsibleTrigger className="group/trigger flex w-full items-center gap-3 border-t px-4 py-2.5 text-left text-[0.8125rem] text-muted-foreground transition-colors duration-150 ease-(--ease-out) outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [@media(hover:hover)]:hover:text-foreground">
          <span className="flex -space-x-1.5">
            {members.slice(0, 5).map((m) => (
              <MemberAvatar key={m.userId} name={m.displayName} size="sm" className={cn(memberDone(goal, m.userId) && "bg-brand/20 text-foreground ring-brand/50")} />
            ))}
          </span>
          <span className="font-mono text-[0.75rem] tabular-nums">
            {doneCount}/{members.length}
          </span>
          <span>done</span>
          <span aria-hidden className="ml-auto h-1 w-20 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-brand transition-[width] duration-300 ease-(--ease-out)" style={{ width: `${(doneCount / Math.max(1, members.length)) * 100}%` }} />
          </span>
          <KeyboardArrowDownIcon className="size-4 transition-transform duration-200 ease-(--ease-out) group-data-[state=open]/trigger:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="grid gap-2.5 px-4 pt-1 pb-4" aria-label={`Progress on “${goal.title}”`}>
            {members.map((m) => (
              <MemberProgressRow key={m.userId} goal={goal} member={m} />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
      {error ? (
        <p role="alert" className="px-4 pb-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function MemberProgressRow({ goal, member }: { goal: RoomGoal; member: RoomMember }) {
  const done = memberDone(goal, member.userId);
  const p = goal.progress[member.userId];
  const fraction = goal.video ? watchedFraction(p?.furthestSeconds ?? 0, goal.video.durationSeconds) : done ? 1 : 0;
  const status = done
    ? "Done"
    : goal.video
      ? p && p.furthestSeconds > 0
        ? `${Math.round(fraction * 100)}% · ${formatTimestamp(p.furthestSeconds)}`
        : "Not started"
      : "Not yet";

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
      <MemberAvatar name={member.displayName} size="sm" />
      <span className="truncate text-[0.8125rem]">
        {member.displayName}
        {member.isMe ? <span className="text-faint"> (you)</span> : null}
      </span>
      <span className={cn("font-mono text-[0.75rem] tabular-nums", done ? "text-foreground" : "text-faint")}>{status}</span>
      {goal.video ? (
        <span aria-hidden className="col-start-2 col-end-4 h-1 overflow-hidden rounded-full bg-muted">
          <span className={cn("block h-full rounded-full", done ? "bg-brand" : "bg-foreground/35")} style={{ width: `${fraction * 100}%` }} />
        </span>
      ) : null}
    </li>
  );
}
