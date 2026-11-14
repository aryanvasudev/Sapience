"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useId, useState, useTransition } from "react";

import {
  CalendarMonthIcon,
  CheckIcon,
  CloseIcon,
  CoffeeIcon,
  EditNoteIcon,
  ForumIcon,
  HelpIcon,
  OpenInNewIcon,
  ReplayIcon,
  SelfImprovementIcon,
  TimerIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { createStudyEvent } from "@/features/calendar/actions";
import { googleCalendarUrl, lessonPath } from "@/lib/calendar/links";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
/** From the third "got distracted" in one sitting, suggest a break instead of pushing on. */
export const DISTRACTION_BREAK_AFTER = 3;
export const BREAK_MINUTES = 5;

type Step = "ask" | "doubt" | "distracted" | "break";

export type PauseCheckInProps = {
  videoId: string;
  lessonTitle: string;
  time: number;
  durationSeconds: number;
  /** "Got distracted" answers so far in this sitting, including this one once chosen. */
  distractions: number;
  onDoubt: (question: string | null) => void;
  onDistracted: () => void;
  onRewind: () => void;
  onNotes: () => void;
  /** Bookmark the current time; resolves false if it couldn't be saved. */
  onSaveSpot: () => Promise<boolean>;
  onStartBreak: () => void;
  onDismiss: () => void;
  onStopAsking: () => void;
};

/**
 * Shown under the player a moment after the student pauses: why did you pause? Each answer gets a
 * follow-up. A doubt goes to the tutor (and the part becomes a weak spot), distraction offers a
 * rewind and, when it keeps happening, a short break; notes open the note box at this time; a
 * break saves the spot and can put "finish this" on the calendar.
 */
export function PauseCheckIn(props: PauseCheckInProps) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("ask");
  const at = formatTimestamp(Math.floor(props.time));

  return (
    <motion.section
      aria-label="Why did you pause?"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="relative grid gap-3 rounded-[14px] border bg-card p-3.5 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]"
    >
      <button
        type="button"
        onClick={props.onDismiss}
        aria-label="Close"
        className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-faint transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground"
      >
        <CloseIcon className="size-4" />
      </button>
      {step === "ask" ? (
        <AskStep at={at} onPick={(s) => {
          if (s === "notes") return props.onNotes();
          if (s === "distracted") props.onDistracted();
          setStep(s);
        }} onDismiss={props.onDismiss} onStopAsking={props.onStopAsking} />
      ) : step === "doubt" ? (
        <DoubtStep at={at} onAsk={props.onDoubt} />
      ) : step === "distracted" ? (
        <DistractedStep count={props.distractions} onRewind={props.onRewind} onBreak={() => setStep("break")} onDismiss={props.onDismiss} />
      ) : (
        <BreakStep {...props} at={at} />
      )}
    </motion.section>
  );
}

const chip =
  "inline-flex h-8 items-center gap-1.5 rounded-full border bg-background px-3 text-[0.8125rem] transition-[background-color,border-color,transform] duration-150 ease-(--ease-out) active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [@media(hover:hover)]:hover:border-foreground/20 [@media(hover:hover)]:hover:bg-raised [&_svg]:size-4 [&_svg]:text-muted-foreground";

function AskStep({
  at,
  onPick,
  onDismiss,
  onStopAsking,
}: {
  at: string;
  onPick: (step: Exclude<Step, "ask"> | "notes") => void;
  onDismiss: () => void;
  onStopAsking: () => void;
}) {
  return (
    <>
      <p className="pr-8 text-sm">
        Paused at <span className="font-mono text-[0.8125rem] text-muted-foreground tabular-nums">{at}</span>. What&apos;s up?
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={chip} onClick={() => onPick("doubt")}>
          <HelpIcon />I have a doubt
        </button>
        <button type="button" className={chip} onClick={() => onPick("distracted")}>
          <SelfImprovementIcon />
          Got distracted
        </button>
        <button type="button" className={chip} onClick={() => onPick("notes")}>
          <EditNoteIcon />
          Taking notes
        </button>
        <button type="button" className={chip} onClick={() => onPick("break")}>
          <CoffeeIcon />
          Need a break
        </button>
        <button type="button" className={cn(chip, "border-transparent bg-transparent text-muted-foreground")} onClick={onDismiss}>
          Just pausing
        </button>
      </div>
      <button
        type="button"
        onClick={onStopAsking}
        className="justify-self-start text-[0.75rem] text-faint underline decoration-faint/30 underline-offset-4 transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:text-muted-foreground"
      >
        Don&apos;t ask again for this lecture
      </button>
    </>
  );
}

function DoubtStep({ at, onAsk }: { at: string; onAsk: (question: string | null) => void }) {
  const id = useId();
  const [question, setQuestion] = useState("");
  return (
    <form
      className="grid gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        onAsk(question.trim() || null);
      }}
    >
      <label htmlFor={id} className="pr-8 text-sm">
        What&apos;s confusing around <span className="font-mono text-[0.8125rem] text-muted-foreground tabular-nums">{at}</span>?
      </label>
      <input
        id={id}
        autoFocus
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={1500}
        placeholder="Optional: type your question"
        className="h-9 w-full rounded-[10px] border bg-background px-3 text-sm transition-[border-color,box-shadow] duration-150 ease-(--ease-out) outline-none placeholder:text-faint focus-visible:border-brand/50 focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_14%,transparent)]"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm">
          <ForumIcon />
          {question.trim() ? "Ask the tutor" : "Explain the last minute"}
        </Button>
        <span className="text-[0.75rem] text-muted-foreground">This part is saved as a weak spot to revise later.</span>
      </div>
    </form>
  );
}

function DistractedStep({
  count,
  onRewind,
  onBreak,
  onDismiss,
}: {
  count: number;
  onRewind: () => void;
  onBreak: () => void;
  onDismiss: () => void;
}) {
  const tired = count >= DISTRACTION_BREAK_AFTER;
  return (
    <>
      <p className="pr-8 text-sm leading-relaxed">
        {tired
          ? `That's ${count} times this sitting. A short break usually helps more than pushing on.`
          : "It happens. Jump back 30 seconds to where your attention drifted?"}
      </p>
      <div className="flex flex-wrap gap-2">
        {tired ? (
          <Button type="button" size="sm" onClick={onBreak}>
            <CoffeeIcon />
            Take a {BREAK_MINUTES}-minute break
          </Button>
        ) : null}
        <Button type="button" size="sm" variant={tired ? "outline" : "default"} onClick={onRewind}>
          <ReplayIcon />
          Rewind 30 s and play
        </Button>
        {!tired ? (
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            I&apos;m fine
          </Button>
        ) : null}
      </div>
      {!tired ? (
        <p className="text-[0.75rem] text-muted-foreground">Tip: put your phone face down and close other tabs until this chapter ends.</p>
      ) : null}
    </>
  );
}

type Reminder = { label: string; at: Date };

function reminderOptions(now: Date): Reminder[] {
  const inHour = new Date(now.getTime() + 60 * 60_000);
  inHour.setSeconds(0, 0);
  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60_000);
  tomorrow.setSeconds(0, 0);
  return [
    { label: "In an hour", at: inHour },
    ...(tonight.getTime() - now.getTime() > 90 * 60_000 ? [{ label: "Tonight, 8 PM", at: tonight }] : []),
    { label: "Tomorrow, this time", at: tomorrow },
  ];
}

function BreakStep({
  videoId,
  lessonTitle,
  time,
  durationSeconds,
  at,
  onSaveSpot,
  onStartBreak,
}: PauseCheckInProps & { at: string }) {
  const [saved, setSaved] = useState<"idle" | "saved" | "failed">("idle");
  const [reminder, setReminder] = useState<{ when: Date; google: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [now] = useState(() => new Date());
  const left = Math.max(0, durationSeconds - time);
  const minutesLeft = Math.min(120, Math.max(15, Math.ceil(left / 60 / 5) * 5));

  const remind = (r: Reminder) =>
    startTransition(async () => {
      setError(null);
      const title = `Finish “${lessonTitle.slice(0, 90)}”`;
      const result = await createStudyEvent({
        title,
        startsAt: r.at.toISOString(),
        durationMinutes: minutesLeft,
        youtubeVideoId: videoId,
        seconds: Math.floor(time),
        notes: `Pick up at ${at}.`,
      });
      if (!result.ok) return setError(result.message);
      const end = new Date(r.at.getTime() + minutesLeft * 60_000);
      setReminder({
        when: r.at,
        google: googleCalendarUrl({
          title,
          startsAt: r.at,
          endsAt: end,
          details: `Pick up at ${at}.`,
          url: `${window.location.origin}${lessonPath(videoId, time)}`,
        }),
      });
    });

  return (
    <>
      <p className="pr-8 text-sm">Good call. Come back to where you left off:</p>
      <div className="flex flex-wrap items-center gap-2">
        {saved === "saved" ? (
          <span role="status" className="inline-flex h-8 items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
            <CheckIcon className="size-4 text-positive" />
            Spot saved at <span className="font-mono tabular-nums">{at}</span>
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void saveSpotThen(onSaveSpot, setSaved)}
          >
            Save my spot ({at})
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={onStartBreak}>
          <TimerIcon />
          {BREAK_MINUTES}-minute timer
        </Button>
      </div>

      {reminder ? (
        <div role="status" className="grid gap-2 rounded-[10px] border border-positive/30 bg-positive/5 p-3 text-[0.8125rem]">
          <p className="flex items-center gap-1.5">
            <CalendarMonthIcon className="size-4 text-positive" />
            On your calendar for{" "}
            {reminder.when.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="xs" variant="outline">
              <a href={reminder.google} target="_blank" rel="noopener noreferrer">
                Add to Google Calendar
                <OpenInNewIcon />
              </a>
            </Button>
            <Button asChild size="xs" variant="ghost">
              <Link href="/app/calendar">Open calendar</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-1.5">
          <p className="text-[0.8125rem] text-muted-foreground">Remind me to finish ({minutesLeft} min):</p>
          <div className="flex flex-wrap gap-1.5">
            {reminderOptions(now).map((r) => (
              <button key={r.label} type="button" className={chip} disabled={pending} onClick={() => remind(r)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {saved === "failed" || error ? (
        <p role="alert" className="animate-fade text-[0.8125rem] text-destructive">
          {error ?? "Couldn't save your spot. Try again."}
        </p>
      ) : null}
    </>
  );
}

async function saveSpotThen(save: () => Promise<boolean>, set: (s: "saved" | "failed") => void) {
  set((await save()) ? "saved" : "failed");
}
