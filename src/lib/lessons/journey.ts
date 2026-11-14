/**
 * The lesson journey (client-safe, pure): one ordered set of steps from "video checked" to
 * "recap seen", plus a sentence saying what is happening right now. The lesson screen renders it
 * as a rail under the title so the student always knows where the build, and they, are.
 *
 * Steps can be active at the same time: the video plays while the notes are still being written.
 */
import { formatTimestamp } from "@/lib/format";
import { LECTURE_DONE_FRACTION, watchedFraction } from "@/lib/rooms/progress";
import type { LessonStatusResponse } from "@/types/contracts";

export type StepState = "done" | "active" | "upcoming" | "failed";
export type JourneyStepId = "video" | "analysis" | "notes" | "watch" | "checkpoints" | "recap";

export type JourneyStep = {
  id: JourneyStepId;
  label: string;
  /** For narrow screens, where six labels share one row. */
  shortLabel: string;
  state: StepState;
  detail: string;
  /** How far through this step, 0–1. `null` while active means "working, length unknown". */
  fraction: number | null;
};

/** working: Sapience is busy. waiting: queued behind something. idle: the student's turn. */
export type JourneyTone = "working" | "waiting" | "idle" | "done" | "failed";

export type Journey = {
  steps: JourneyStep[];
  headline: string;
  hint: string | null;
  tone: JourneyTone;
  /** The whole journey, 0–1, for the progress bar's accessible value. */
  overall: number;
};

export type JourneyInput = {
  data: LessonStatusResponse;
  /** Polling gave up (use-lesson-status): the build is taking longer than usual. */
  stalled: boolean;
  /** Furthest point actually played, in seconds. */
  furthestSeconds: number;
  ended: boolean;
  playing: boolean;
  checkpointsAnswered: number;
  recapSeen: boolean;
  /** Chapter position of the open checkpoint card, if any. */
  checkpointOpen: number | null;
  currentChapter: { position: number; title: string } | null;
};

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function lessonJourney(input: JourneyInput): Journey {
  const { data, stalled } = input;
  const status = data.status;
  const chapters = data.lesson?.chapters ?? [];
  const total = data.progress.chaptersTotal;
  const ready = data.progress.chaptersReady;
  const failedChapters = chapters.filter((c) => c.status === "failed").length;
  const outlined = total > 0;
  const lessonFailed = status === "failed";
  const fromTranscript = data.lesson?.source === "transcript_paste";
  const notesBuilding = outlined && !lessonFailed && ready + failedChapters < total;
  const analysing = !outlined && !lessonFailed && status !== "ready";

  const checkpointTotal = chapters.filter((c) => c.checkpoint).length;
  const answered = Math.min(input.checkpointsAnswered, checkpointTotal);
  const watched = watchedFraction(input.furthestSeconds, data.video.durationSeconds);
  const watchDone = input.ended || watched >= LECTURE_DONE_FRACTION;
  const checkpointsDone = checkpointTotal > 0 && answered >= checkpointTotal && !notesBuilding;

  // --- Steps -------------------------------------------------------------------------------

  const video: JourneyStep = { id: "video", label: "Video", shortLabel: "Video", state: "done", detail: "Checked", fraction: 1 };

  const analysis: JourneyStep = {
    id: "analysis",
    label: fromTranscript ? "Transcript" : "Analysis",
    shortLabel: fromTranscript ? "Script" : "Analysis",
    ...(outlined || status === "ready"
      ? { state: "done", detail: "Done", fraction: 1 }
      : lessonFailed
        ? { state: "failed", detail: "Stopped", fraction: 0 }
        : stalled
          ? { state: "active", detail: "Slow", fraction: null }
          : status === "queued"
            ? { state: "active", detail: data.waitingForCapacity ? "Waiting" : "Queued", fraction: null }
            : { state: "active", detail: fromTranscript ? "Reading" : "Watching", fraction: null }),
  };

  const notes: JourneyStep = {
    id: "notes",
    label: "Notes",
    shortLabel: "Notes",
    ...(!outlined
      ? { state: lessonFailed ? "failed" : "upcoming", detail: lessonFailed ? "—" : "Next", fraction: 0 }
      : notesBuilding
        ? { state: "active", detail: `${ready}/${total}`, fraction: ready / total }
        : failedChapters > 0 || lessonFailed
          ? { state: "failed", detail: `${ready}/${total}`, fraction: ready / total }
          : { state: "done", detail: plural(total, "chapter"), fraction: 1 }),
  };

  const watch: JourneyStep = {
    id: "watch",
    label: "Watch",
    shortLabel: "Watch",
    ...(watchDone
      ? { state: "done", detail: "Finished", fraction: 1 }
      : watched > 0 || input.playing
        ? { state: "active", detail: percent(watched), fraction: watched }
        : { state: "upcoming", detail: "Not started", fraction: 0 }),
  };

  const checkpoints: JourneyStep = {
    id: "checkpoints",
    label: "Checkpoints",
    shortLabel: "Checks",
    ...(checkpointTotal === 0
      ? { state: "upcoming", detail: outlined && !notesBuilding ? "None" : "Per chapter", fraction: 0 }
      : checkpointsDone
        ? { state: "done", detail: `${answered}/${checkpointTotal}`, fraction: 1 }
        : answered > 0 || input.checkpointOpen !== null
          ? { state: "active", detail: `${answered}/${checkpointTotal}`, fraction: answered / checkpointTotal }
          : { state: "upcoming", detail: `0/${checkpointTotal}`, fraction: 0 }),
  };

  const recapReady = data.lesson !== undefined && (watchDone || checkpointsDone);
  const recap: JourneyStep = {
    id: "recap",
    label: "Recap",
    shortLabel: "Recap",
    ...(input.recapSeen
      ? { state: "done", detail: "Seen", fraction: 1 }
      : recapReady
        ? { state: "active", detail: "Open it", fraction: 0 }
        : { state: "upcoming", detail: "At the end", fraction: 0 }),
  };

  const steps = [video, analysis, notes, watch, checkpoints, recap];
  const overall =
    steps.reduce((sum, s) => sum + (s.state === "done" ? 1 : s.state === "active" ? (s.fraction ?? 0.5) : 0), 0) / steps.length;

  return { steps, overall, ...describe() };

  // --- What is happening now --------------------------------------------------------------

  function describe(): Pick<Journey, "headline" | "hint" | "tone"> {
    if (lessonFailed && !outlined) {
      return {
        tone: "failed",
        headline: "We couldn't build this lesson.",
        hint: "The video still plays. You can try again, or build the lesson from the video's transcript instead.",
      };
    }
    if (stalled && (analysing || notesBuilding)) {
      return { tone: "waiting", headline: "This is taking longer than usual.", hint: "The video still plays. Check again in a moment." };
    }
    if (analysing && status === "queued") {
      return data.waitingForCapacity
        ? {
            tone: "waiting",
            headline: "Waiting for free AI capacity…",
            hint: "Your lesson is queued and starts on its own. The video already plays.",
          }
        : { tone: "waiting", headline: "Your lesson is in the queue…", hint: "It starts in a few seconds. The video already plays." };
    }
    if (analysing) {
      return {
        tone: "working",
        headline: fromTranscript ? "Reading the transcript…" : "AI is watching the lecture…",
        hint: "It's splitting the lecture into chapters. This usually takes a minute or two, and the video already plays.",
      };
    }
    if (notesBuilding) {
      return {
        tone: data.waitingForCapacity ? "waiting" : "working",
        headline: data.waitingForCapacity
          ? `Waiting for free AI capacity… ${ready} of ${total} chapters ready`
          : `Writing notes: ${ready} of ${total} chapters ready`,
        hint: "Ready chapters work now. The rest fill in as they're built.",
      };
    }
    if (input.checkpointOpen !== null) {
      return { tone: "idle", headline: `Checkpoint for chapter ${input.checkpointOpen + 1}`, hint: "Answer it to keep going." };
    }
    if (input.playing && input.currentChapter) {
      const progress = [`${percent(watched)} watched`, checkpointTotal > 0 ? `${answered} of ${checkpointTotal} checkpoints` : null];
      return {
        tone: "idle",
        headline: `Watching chapter ${input.currentChapter.position + 1}: ${input.currentChapter.title}`,
        hint: progress.filter(Boolean).join(" · "),
      };
    }
    if (failedChapters > 0) {
      return {
        tone: "failed",
        headline: `${plural(failedChapters, "chapter")} didn't build.`,
        hint: "Retry from the chapter list. Everything else works.",
      };
    }
    if (input.recapSeen && (checkpointsDone || checkpointTotal === 0) && watchDone) {
      return { tone: "done", headline: "You've finished this lecture.", hint: "A quiz or flashcards in Practice keeps it fresh." };
    }
    if (recapReady && !input.recapSeen) {
      return { tone: "done", headline: "You've reached the end.", hint: "Open the recap to see what stuck and what to rewatch." };
    }
    if (input.furthestSeconds > 0) {
      return {
        tone: "idle",
        headline: "Pick up where you left off.",
        hint: `${percent(watched)} watched, up to ${formatTimestamp(input.furthestSeconds)}. Press play to continue.`,
      };
    }
    return {
      tone: "idle",
      headline: "Your lesson is ready.",
      hint: checkpointTotal > 0 ? "Press play to start. A checkpoint question comes at the end of each chapter." : "Press play to start.",
    };
  }
}
