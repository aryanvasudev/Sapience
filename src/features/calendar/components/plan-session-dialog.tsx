"use client";

import { useId, useState, useTransition } from "react";

import { ArrowOutwardIcon, CheckCircleIcon, EditCalendarIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clientEnv } from "@/env-client";
import { googleCalendarUrl, lessonPath } from "@/lib/calendar/links";
import type { StudyEvent } from "@/lib/calendar/service";
import { formatTimestamp } from "@/lib/format";

import { createStudyEvent } from "../actions";
import { formatLongDay, formatTimeRange } from "../days";

export type LectureOption = { videoId: string; title: string; positionSeconds: number };

const DURATIONS = [25, 45, 60, 90, 120];

const durationLabel = (d: number) =>
  d < 60 ? `${d} min` : d % 60 === 0 ? `${d / 60} h` : `${Math.floor(d / 60)} h ${d % 60} min`;

/** The absolute "open in Sapience" link for an event's lecture, if it has one. */
export function eventLectureUrl(event: StudyEvent): string | null {
  return event.youtubeVideoId ? new URL(lessonPath(event.youtubeVideoId, event.seconds), clientEnv().NEXT_PUBLIC_APP_URL).toString() : null;
}

export function googleUrlFor(event: StudyEvent): string {
  return googleCalendarUrl({
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    details: event.notes,
    url: eventLectureUrl(event),
  });
}

/** The next whole hour today, or 18:00 on another day. */
function defaultTime(day: string, today: string): string {
  if (day !== today) return "18:00";
  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next.getDate() === new Date().getDate() ? `${String(next.getHours()).padStart(2, "0")}:00` : "23:00";
}

/**
 * Plan a study session. Opened with a day already chosen (the selected day in the grid). After it
 * saves, the dialog shows the session with a one-click "Add to Google Calendar".
 */
export function PlanSessionDialog({
  open,
  onOpenChange,
  day,
  today,
  lectures,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: string;
  today: string;
  lectures: LectureOption[];
  onCreated: (event: StudyEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Keyed so each opening starts from a clean form for the chosen day. */}
        {open ? <PlanForm key={day} day={day} today={today} lectures={lectures} onCreated={onCreated} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PlanForm({
  day,
  today,
  lectures,
  onCreated,
  onDone,
}: {
  day: string;
  today: string;
  lectures: LectureOption[];
  onCreated: (event: StudyEvent) => void;
  onDone: () => void;
}) {
  const id = useId();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(day);
  const [time, setTime] = useState(() => defaultTime(day, today));
  const [duration, setDuration] = useState(45);
  const [videoId, setVideoId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<StudyEvent | null>(null);
  const [pending, startTransition] = useTransition();

  const lecture = lectures.find((l) => l.videoId === videoId) ?? null;

  const submit = () => {
    setError(null);
    const name = title.trim() || (lecture ? `Study: ${lecture.title}`.slice(0, 120) : "");
    if (!name) return setError("Give the session a name, or pick a lecture.");
    const start = new Date(`${date}T${time}`);
    if (!date || !time || Number.isNaN(start.getTime())) return setError("Choose a date and a start time.");
    startTransition(async () => {
      const result = await createStudyEvent({
        title: name,
        notes: notes.trim() || undefined,
        startsAt: start.toISOString(),
        durationMinutes: duration,
        ...(lecture ? { youtubeVideoId: lecture.videoId, ...(lecture.positionSeconds > 0 ? { seconds: lecture.positionSeconds } : {}) } : {}),
      });
      if (!result.ok) return setError(result.message);
      setSaved(result.event);
      onCreated(result.event);
    });
  };

  if (saved) {
    return (
      <div className="grid gap-5 animate-fade">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-medium tracking-[-0.01em]">
            <CheckCircleIcon className="size-5 text-brand" />
            Added to your calendar
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            It&apos;s in Sapience now. Add it to Google Calendar too if you want a reminder on your phone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1 rounded-[10px] border bg-card p-3">
          <p className="font-mono text-[0.75rem] text-muted-foreground tabular-nums">
            {formatLongDay(date)} · {formatTimeRange(saved.startsAt, saved.endsAt)}
          </p>
          <p className="text-sm font-medium">{saved.title}</p>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button asChild variant="outline">
            <a href={googleUrlFor(saved)} target="_blank" rel="noopener noreferrer">
              Add to Google Calendar
              <ArrowOutwardIcon className="size-4" />
            </a>
          </Button>
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-lg font-medium tracking-[-0.01em]">
          <EditCalendarIcon className="size-5 text-muted-foreground" />
          Plan a study session
        </DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">
          Block out time for a lecture or a revision round. It shows up here and in your synced calendar.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <label htmlFor={`${id}-lecture`} className="text-sm font-medium">
            Lecture <span className="font-normal text-faint">(optional)</span>
          </label>
          <SelectField
            id={`${id}-lecture`}
            value={videoId}
            onValueChange={setVideoId}
            options={[
              { value: "", label: "No lecture" },
              ...lectures.map((l) => ({ value: l.videoId, label: l.title.length > 70 ? `${l.title.slice(0, 69)}…` : l.title })),
            ]}
            className="h-11 bg-card md:h-10"
            contentClassName="w-(--radix-select-trigger-width)"
          />
          {lecture && lecture.positionSeconds > 0 ? (
            <p className="text-[0.8125rem] text-muted-foreground">
              Opens where you stopped, at <span className="font-mono tabular-nums">{formatTimestamp(lecture.positionSeconds)}</span>.
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label htmlFor={`${id}-title`} className="text-sm font-medium">
            Name
          </label>
          <Input
            id={`${id}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder={lecture ? `Study: ${lecture.title}` : "e.g. Finish thermodynamics, chapter 3"}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.3fr_1fr_1fr]">
          <div className="col-span-2 grid gap-2 sm:col-span-1">
            <label htmlFor={`${id}-date`} className="text-sm font-medium">
              Date
            </label>
            <Input id={`${id}-date`} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <label htmlFor={`${id}-time`} className="text-sm font-medium">
              Starts
            </label>
            <Input id={`${id}-time`} type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <label htmlFor={`${id}-duration`} className="text-sm font-medium">
              Length
            </label>
            <SelectField
              id={`${id}-duration`}
              value={String(duration)}
              onValueChange={(v) => setDuration(Number(v))}
              options={DURATIONS.map((d) => ({ value: String(d), label: durationLabel(d) }))}
              className="h-11 bg-card md:h-10"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <label htmlFor={`${id}-notes`} className="text-sm font-medium">
            Notes <span className="font-normal text-faint">(optional)</span>
          </label>
          <Textarea
            id={`${id}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="What do you want to get done?"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="animate-fade text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add to calendar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
