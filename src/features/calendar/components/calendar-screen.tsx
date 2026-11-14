"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";

import {
  AddIcon,
  ArrowOutwardIcon,
  ChevronRightIcon,
  DeleteIcon,
  EventRepeatIcon,
  Flag2Icon,
  PlayCircleIcon,
  SyncIcon,
} from "@/components/icons";
import { PageHeader, SectionHeading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { lessonPath } from "@/lib/calendar/links";
import type { RoomDeadline, StudyEvent } from "@/lib/calendar/service";
import { formatTimestamp } from "@/lib/format";

import { deleteStudyEvent } from "../actions";
import { addDays, dayKey, formatDayLabel, formatTime, formatTimeRange, monthOf, type MonthView } from "../days";
import { MonthGrid, type DayMarks } from "./month-grid";
import { googleUrlFor, PlanSessionDialog, type LectureOption } from "./plan-session-dialog";
import { SyncDialog } from "./sync-dialog";

const COMING_UP_DAYS = 7;

/**
 * The browser's clock, or null during server render and hydration (days and times depend on the
 * student's time zone). Re-read every minute so "today" moves on at midnight.
 */
let clientNow: number | null = null;
function subscribeClock(onChange: () => void) {
  const tick = () => {
    clientNow = Date.now();
    onChange();
  };
  tick();
  const timer = window.setInterval(tick, 60_000);
  return () => window.clearInterval(timer);
}
const readClock = () => (clientNow ??= Date.now());
const useNow = () => useSyncExternalStore(subscribeClock, readClock, () => null);

export function CalendarScreen({
  initialEvents,
  deadlines,
  revisionDue,
  lectures,
  isAnonymous,
}: {
  initialEvents: StudyEvent[];
  deadlines: RoomDeadline[];
  /** Due dates of saved concepts (ISO). */
  revisionDue: string[];
  lectures: LectureOption[];
  isAnonymous: boolean;
}) {
  const now = useNow();
  const mounted = now !== null;
  const [events, setEvents] = useState(initialEvents);
  const [planOpen, setPlanOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  // Chosen after mount (null = follow today).
  const [selectedState, setSelected] = useState<string | null>(null);
  const [viewState, setView] = useState<MonthView | null>(null);

  const today = now !== null ? dayKey(new Date(now)) : "";
  const selected = selectedState ?? today;
  const view = viewState ?? (today ? monthOf(today) : { year: 2000, month: 0 });

  const byDay = useMemo(() => {
    const map = new Map<string, { sessions: StudyEvent[]; deadlines: RoomDeadline[]; revision: number }>();
    if (now === null) return map;
    const entry = (key: string) => {
      let e = map.get(key);
      if (!e) map.set(key, (e = { sessions: [], deadlines: [], revision: 0 }));
      return e;
    };
    for (const ev of events) entry(dayKey(new Date(ev.startsAt))).sessions.push(ev);
    for (const d of deadlines) entry(dayKey(new Date(d.dueAt))).deadlines.push(d);
    const todayKey = dayKey(new Date(now));
    for (const due of revisionDue) entry(new Date(due).getTime() <= now ? todayKey : dayKey(new Date(due))).revision += 1;
    for (const e of map.values()) e.sessions.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [events, deadlines, revisionDue, now]);

  const marks = useMemo(() => {
    const m = new Map<string, DayMarks>();
    for (const [key, e] of byDay) m.set(key, { sessions: e.sessions.length, deadlines: e.deadlines.length, revision: e.revision });
    return m;
  }, [byDay]);

  const lectureTitles = useMemo(() => new Map(lectures.map((l) => [l.videoId, l.title])), [lectures]);

  const actions = (
    <>
      <Button type="button" variant="outline" onClick={() => setSyncOpen(true)}>
        <SyncIcon />
        Sync with Google Calendar
      </Button>
      <Button type="button" onClick={() => setPlanOpen(true)} disabled={!mounted}>
        <AddIcon />
        Plan a session
      </Button>
    </>
  );

  const header = (
    <PageHeader
      title="Calendar"
      description="Plan when you'll study. Room deadlines and revision days show up here on their own."
      actions={actions}
    />
  );

  if (!mounted) {
    return (
      <div className="grid gap-10">
        {header}
        <CalendarBodySkeleton />
      </div>
    );
  }

  const day = byDay.get(selected);
  const comingUp = Array.from({ length: COMING_UP_DAYS }, (_, i) => addDays(today, i + 1))
    .map((key) => ({ key, entry: byDay.get(key) }))
    .filter(({ entry }) => entry && (entry.sessions.length > 0 || entry.deadlines.length > 0));

  return (
    <div className="grid gap-10">
      {header}

      <div className="enter grid gap-10 [--i:1] lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-label="Month" className="min-w-0">
          <MonthGrid view={view} selected={selected} today={today} marks={marks} onSelect={setSelected} onViewChange={setView} />
        </section>

        <div className="grid min-w-0 content-start gap-10">
          <section aria-labelledby="day-heading" className="grid gap-3">
            <SectionHeading
              id="day-heading"
              meta={
                <Button type="button" size="xs" variant="ghost" className="text-muted-foreground" onClick={() => setPlanOpen(true)}>
                  <AddIcon />
                  Add
                </Button>
              }
            >
              {formatDayLabel(selected, today)}
            </SectionHeading>
            {day && (day.sessions.length || day.deadlines.length || day.revision) ? (
              <ul key={selected} className="grid animate-fade gap-2 [animation-duration:200ms]">
                {day.revision > 0 ? <RevisionItem count={day.revision} isPast={selected < today} /> : null}
                {day.deadlines.map((d) => (
                  <DeadlineItem key={d.id} deadline={d} />
                ))}
                {day.sessions.map((ev) => (
                  <SessionItem
                    key={ev.id}
                    event={ev}
                    lectureTitle={ev.youtubeVideoId ? (lectureTitles.get(ev.youtubeVideoId) ?? null) : null}
                    onDeleted={() => setEvents((es) => es.filter((e) => e.id !== ev.id))}
                  />
                ))}
              </ul>
            ) : (
              <div key={selected} className="grid animate-fade gap-3 rounded-2xl border border-dashed p-5 [animation-duration:200ms]">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {selected < today ? "Nothing was planned for this day." : "Nothing planned yet."}
                </p>
                {selected >= today ? (
                  <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={() => setPlanOpen(true)}>
                    <AddIcon />
                    Plan a session
                  </Button>
                ) : null}
              </div>
            )}
          </section>

          <section aria-labelledby="coming-up-heading" className="grid gap-3">
            <SectionHeading id="coming-up-heading">Coming up</SectionHeading>
            {comingUp.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing in the next week.</p>
            ) : (
              <ul className="grid">
                {comingUp.map(({ key, entry }) => (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(key);
                        setView(monthOf(key));
                      }}
                      className="group grid w-full grid-cols-[5.5rem_minmax(0,1fr)_auto] items-baseline gap-3 rounded-md px-2 py-2 text-left outline-none transition-colors duration-150 ease-(--ease-out) focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-muted/60"
                    >
                      <span className="text-[0.8125rem] text-muted-foreground">{formatDayLabel(key, today)}</span>
                      <span className="grid min-w-0 gap-0.5">
                        {entry?.deadlines.map((d) => (
                          <span key={d.id} className="flex min-w-0 items-center gap-1.5 text-sm">
                            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand" />
                            <span className="truncate">{d.title}</span>
                          </span>
                        ))}
                        {entry?.sessions.map((ev) => (
                          <span key={ev.id} className="flex min-w-0 items-baseline gap-2 text-sm">
                            <span className="shrink-0 font-mono text-[0.75rem] text-faint tabular-nums">{formatTime(ev.startsAt)}</span>
                            <span className="truncate">{ev.title}</span>
                          </span>
                        ))}
                      </span>
                      <ChevronRightIcon className="size-4 self-center text-faint transition-transform duration-150 ease-(--ease-out) [@media(hover:hover)]:group-hover:translate-x-0.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <PlanSessionDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        day={selected < today ? today : selected}
        today={today}
        lectures={lectures}
        onCreated={(event) => {
          setEvents((es) => [...es, event]);
          const key = dayKey(new Date(event.startsAt));
          setSelected(key);
          setView(monthOf(key));
        }}
      />
      <SyncDialog open={syncOpen} onOpenChange={setSyncOpen} isAnonymous={isAnonymous} />
    </div>
  );
}

const ITEM = "grid gap-1.5 rounded-[10px] border bg-card p-3 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]";

function SessionItem({ event, lectureTitle, onDeleted }: { event: StudyEvent; lectureTitle: string | null; onDeleted: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className={ITEM}>
      <div className="-my-0.5 -mr-1 flex items-center gap-2">
        <span className="font-mono text-[0.75rem] text-muted-foreground tabular-nums">{formatTimeRange(event.startsAt, event.endsAt)}</span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="ml-auto text-faint [@media(hover:hover)]:hover:text-foreground"
          disabled={pending}
          aria-label={`Delete “${event.title}”`}
          onClick={() =>
            startTransition(async () => {
              const r = await deleteStudyEvent({ id: event.id });
              if (r.ok) onDeleted();
              else setError("Couldn't delete that. Try again.");
            })
          }
        >
          <DeleteIcon />
        </Button>
      </div>
      <p className="text-sm font-medium">{event.title}</p>
      {event.notes ? <p className="line-clamp-3 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{event.notes}</p> : null}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 pt-1">
        {event.youtubeVideoId ? (
          <Button asChild size="xs" variant="ghost" className="-ml-2 max-w-full text-foreground">
            <Link href={lessonPath(event.youtubeVideoId, event.seconds)} title={lectureTitle ?? undefined}>
              <PlayCircleIcon />
              <span className="truncate">
                {event.seconds ? (
                  <>
                    Open lecture at <span className="font-mono tabular-nums">{formatTimestamp(event.seconds)}</span>
                  </>
                ) : (
                  "Open lecture"
                )}
              </span>
            </Link>
          </Button>
        ) : null}
        <Button asChild size="xs" variant="ghost" className={event.youtubeVideoId ? "text-muted-foreground" : "-ml-2 text-muted-foreground"}>
          <a href={googleUrlFor(event)} target="_blank" rel="noopener noreferrer">
            Add to Google Calendar
            <ArrowOutwardIcon />
          </a>
        </Button>
      </div>
      {error ? (
        <p role="alert" className="animate-fade text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function DeadlineItem({ deadline }: { deadline: RoomDeadline }) {
  return (
    <li>
      <Link
        href={`/app/rooms/${deadline.roomId}`}
        className={`${ITEM} group outline-none transition-[background-color,border-color] duration-150 ease-(--ease-out) focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:border-foreground/20`}
      >
        <span className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
          <Flag2Icon className="size-4 text-brand" />
          Due · <span className="truncate">{deadline.roomName}</span>
        </span>
        <span className="text-sm font-medium">{deadline.title}</span>
      </Link>
    </li>
  );
}

function RevisionItem({ count, isPast }: { count: number; isPast: boolean }) {
  return (
    <li>
      <Link
        href="/app/revision"
        className={`${ITEM} flex! items-center gap-3 outline-none transition-[border-color] duration-150 ease-(--ease-out) focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:border-foreground/20`}
      >
        <EventRepeatIcon className="size-4.5 text-muted-foreground" />
        <span className="text-sm">
          <span className="font-mono tabular-nums">{count}</span> {count === 1 ? "concept" : "concepts"} {isPast ? "were due" : "due for revision"}
        </span>
        <ChevronRightIcon className="ml-auto size-4 text-faint" />
      </Link>
    </li>
  );
}

export function CalendarBodySkeleton() {
  return (
    <div aria-hidden className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid content-start gap-4">
        <div className="h-7 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-[10px] bg-muted/60 motion-reduce:animate-none sm:h-16" />
          ))}
        </div>
      </div>
      <div className="grid content-start gap-3">
        <div className="h-5 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted/70 motion-reduce:animate-none" />
      </div>
    </div>
  );
}
