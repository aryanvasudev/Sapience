"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { DescriptionIcon, ForumIcon, NotesIcon, OpenInNewIcon, ProgressActivityIcon, QuizIcon, RefreshIcon, StickyNote2Icon } from "@/components/icons";
import { MorphText } from "@/components/motion/morph-text";
import { SectionHeading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { MorphTabsList } from "@/components/ui/morph-tabs";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { OUTPUT_LANGUAGE_NAMES, type OutputLanguage, type TutorStyle } from "@/config/enums";
import { addNote } from "@/features/notes/actions";
import { bySeconds, MyNotesPanel } from "@/features/notes/my-notes-panel";
import { FlashcardsPanel } from "@/features/practice/flashcards-panel";
import { QuizPanel } from "@/features/practice/quiz-panel";
import { TutorPanel } from "@/features/tutor/components/tutor-panel";
import { useTutor } from "@/features/tutor/hooks/use-tutor";
import { addWeakSpot, getWeakSpots } from "@/features/weak-spots/actions";
import { WeakSpotsPanel } from "@/features/weak-spots/weak-spots-panel";
import { requestJson } from "@/lib/client-api";
import { formatDuration, formatTimestamp } from "@/lib/format";
import { seekTarget } from "@/lib/timestamps";
import type { PersonalNote } from "@/lib/notes/service";
import type { TutorUIMessage } from "@/lib/tutor/types";
import { checkpointRange, doubtRange, revisionPlaylist, weakTopics, type TimeRange, type WeakSpot } from "@/lib/weak-spots/aggregate";
import type { AttemptResult, ChapterPublic, LessonStatusResponse } from "@/types/contracts";

import { useCheckpoints } from "../hooks/use-checkpoints";
import { isBuilding, useLessonStatus } from "../hooks/use-lesson-status";
import { usePlaybackClock, usePlayerKeyboard, useProgressSaving } from "../hooks/use-playback";
import { useYouTubePlayer } from "../hooks/use-youtube-player";
import { ChapterList, ChapterTimeline } from "./chapter-list";
import { CheckpointCard } from "./checkpoint-card";
import { LessonJourney } from "./journey";
import { NotesPanel } from "./notes-panel";
import { BREAK_MINUTES, PauseCheckIn } from "./pause-check-in";
import { PlayerBar } from "./player-bar";
import { RecapPanel } from "./recap-panel";
import { SearchPanel } from "./search-panel";
import { ShareButton } from "./share-button";
import { TranscriptDialog } from "./transcript-dialog";

const RetryResponseSchema = z.object({ status: z.string() });

export function chapterAt(chapters: ChapterPublic[], seconds: number): ChapterPublic | null {
  return chapters.find((c) => seconds >= c.startSeconds && seconds < c.endSeconds) ?? chapters[chapters.length - 1] ?? null;
}

/**
 * Four tabs, each with at most two views, so nothing competes for the narrow column:
 * Notes (chapter notes · find), Tutor, Practice (quiz · flashcards), Mine (weak spots · saved).
 */
type PanelTab = "notes" | "tutor" | "practice" | "mine";
const PANEL_TABS: readonly PanelTab[] = ["notes", "tutor", "practice", "mine"];
const PANEL_TAB_ITEMS = [
  { value: "notes", label: "Notes", icon: <NotesIcon /> },
  { value: "tutor", label: "Tutor", icon: <ForumIcon /> },
  { value: "practice", label: "Practice", icon: <QuizIcon /> },
  { value: "mine", label: "Mine", icon: <StickyNote2Icon /> },
] satisfies { value: PanelTab; label: string; icon: React.ReactNode }[];

type NotesView = "chapter" | "find";
type PracticeView = "quiz" | "cards";
type MineView = "weak" | "saved";

/** Tab panels fade in when shown; the force-mounted ones restart the fade when they unhide. */
const TAB_PANEL = "animate-fade [animation-duration:200ms]";
const SUB_TABS = "h-8 [&_button]:text-[0.75rem]";

/** Pauses we cause (checkpoints) within this window aren't the student's, so no check-in. */
const QUIET_PAUSE_MS = 1500;
/** Wait this long after a pause before asking why: seeking and buffering pause briefly. */
const CHECK_IN_DELAY_MS = 900;

export function LessonScreen({
  initial,
  videoId,
  language,
  startSeconds,
  initialFurthest = 0,
  pauseForCheckpoints,
  askWhyPaused,
  defaultStyle,
  initialMessages,
  initialNotes,
  initialWeakSpots,
}: {
  initial: LessonStatusResponse;
  videoId: string;
  language: OutputLanguage;
  startSeconds: number;
  /** Furthest point already played in earlier visits (lesson_progress.furthest_seconds). */
  initialFurthest?: number;
  pauseForCheckpoints: boolean;
  askWhyPaused: boolean;
  defaultStyle: TutorStyle;
  initialMessages: TutorUIMessage[];
  initialNotes: PersonalNote[];
  initialWeakSpots: WeakSpot[];
}) {
  const router = useRouter();
  const { data, stalled, refresh } = useLessonStatus(initial, videoId, language);
  const player = useYouTubePlayer(videoId, startSeconds);
  const { mount: mountPlayer, error: playerError, getCurrentTime, ready: playerReady, play, pause } = player;
  const time = usePlaybackClock(player);
  const furthest = useProgressSaving(player, videoId, language, initialFurthest);
  usePlayerKeyboard(player);

  const lesson = data.lesson;
  const chapters = useMemo(() => lesson?.chapters ?? [], [lesson]);
  const now = playerReady ? time : startSeconds;
  const current = chapters.length > 0 ? chapterAt(chapters, now) : null;
  const currentPosition = current?.position ?? null;

  // Notes follow playback until the student picks another chapter; moving into a new chapter
  // during playback hands control back to the video.
  const [manual, setManual] = useState<{ position: number; during: number | null } | null>(null);
  const selectedPosition = manual && manual.during === currentPosition ? manual.position : currentPosition;
  const selected = chapters.find((c) => c.position === selectedPosition) ?? null;

  const [retrying, setRetrying] = useState<number | "lesson" | null>(null);
  const [tab, setTab] = useState<PanelTab>(lesson ? "notes" : "tutor");
  const [notesView, setNotesView] = useState<NotesView>("chapter");
  const [practiceView, setPracticeView] = useState<PracticeView>("quiz");

  // Answers from this session show immediately; the server copy catches up on the next poll.
  const [localAttempts, setLocalAttempts] = useState<LessonStatusResponse["attempts"]>({});
  const attempts = useMemo(() => ({ ...data.attempts, ...localAttempts }), [data.attempts, localAttempts]);
  const answered = useMemo(() => new Set(Object.keys(attempts)), [attempts]);

  // The student's own material: notes and saved moments, and weak spots.
  const [notes, setNotes] = useState(initialNotes);
  const [spots, setSpots] = useState(initialWeakSpots);
  const topics = useMemo(() => weakTopics(spots, chapters, attempts), [spots, chapters, attempts]);
  const weakRanges = useMemo(() => revisionPlaylist(topics), [topics]);
  const moments = useMemo(() => notes.flatMap((n) => (n.kind === "bookmark" && n.seconds !== null ? [n.seconds] : [])), [notes]);
  const [mineView, setMineView] = useState<MineView>(() => (weakTopics(initialWeakSpots, initial.lesson?.chapters ?? [], initial.attempts).length > 0 ? "weak" : "saved"));
  const [noteFocus, setNoteFocus] = useState(0);
  const [quizPreset, setQuizPreset] = useState<{ position: number; key: number } | null>(null);

  const addSpot = useCallback((spot: WeakSpot) => setSpots((prev) => [...prev.filter((s) => s.id !== spot.id), spot]), []);
  const refreshSpots = useCallback(async () => setSpots(await getWeakSpots({ videoId })), [videoId]);

  const getTimestamp = useCallback(
    () => (playerReady ? getCurrentTime() : startSeconds),
    [playerReady, getCurrentTime, startSeconds],
  );
  const tutor = useTutor({ videoId, language, initialMessages, getTimestamp });

  // Pauses Sapience makes (a checkpoint) are marked so the pause check-in ignores them.
  const quietPauseAt = useRef(0);
  const pauseQuietly = useCallback(() => {
    quietPauseAt.current = Date.now();
    pause();
  }, [pause]);

  const checkpoints = useCheckpoints({
    chapters,
    answered,
    time,
    playerState: player.state,
    autoPause: pauseForCheckpoints,
    pause: pauseQuietly,
  });
  // The recap opens when the video ends (after any final checkpoint) or from the chapter list.
  const [recapOpen, setRecapOpen] = useState(false);
  // For the journey's last step: the recap has been seen once this visit.
  const [recapSeen, setRecapSeen] = useState(false);
  if (recapOpen && !recapSeen) setRecapSeen(true);
  const [endedSeen, setEndedSeen] = useState(player.state === "ended");
  if ((player.state === "ended") !== endedSeen) {
    setEndedSeen(player.state === "ended");
    if (player.state === "ended" && lesson) setRecapOpen(true);
  }

  const active = checkpoints.active;
  const activeChapter = active ? chapters.find((c) => c.position === active.chapterPosition) : undefined;
  const activeQuestion = activeChapter?.checkpoint ?? null;

  const seek = useCallback((seconds: number) => player.seekTo(seconds), [player]);

  const openMine = useCallback((view: MineView) => {
    setRecapOpen(false);
    setTab("mine");
    setMineView(view);
  }, []);

  // -------------------------------------------------------------------------
  // Revise weak spots: play the ranges back to back.
  // -------------------------------------------------------------------------
  const [revise, setRevise] = useState<{ id: number; ranges: TimeRange[]; index: number } | null>(null);
  const [reviseFinished, setReviseFinished] = useState(0);
  const reviseRange = revise ? (revise.ranges[revise.index] ?? null) : null;
  if (revise && reviseRange && player.state === "playing" && time >= reviseRange.endSeconds - 0.25) {
    if (revise.index + 1 < revise.ranges.length) setRevise({ ...revise, index: revise.index + 1 });
    else {
      setRevise(null);
      setReviseFinished((n) => n + 1);
    }
  }
  const reviseTick = revise ? `${revise.id}:${revise.index}` : null;
  const reviseStart = reviseRange?.startSeconds ?? null;
  useEffect(() => {
    if (reviseTick === null || reviseStart === null) return;
    seek(reviseStart);
    play();
  }, [reviseTick, reviseStart, seek, play]);
  useEffect(() => {
    if (reviseFinished === 0) return;
    pauseQuietly();
    toast.success("That's every weak spot. Try a quiz to check they've stuck.");
  }, [reviseFinished, pauseQuietly]);

  const startRevise = useCallback(
    (ranges: TimeRange[]) => {
      if (ranges.length === 0) return;
      checkpoints.close();
      setRevise((prev) => ({ id: (prev?.id ?? 0) + 1, ranges, index: 0 }));
    },
    [checkpoints],
  );
  const skipRevise = () => {
    if (!revise) return;
    if (revise.index + 1 < revise.ranges.length) setRevise({ ...revise, index: revise.index + 1 });
    else {
      setRevise(null);
      setReviseFinished((n) => n + 1);
    }
  };

  // -------------------------------------------------------------------------
  // Pause check-in: a moment after the student pauses, ask why.
  // -------------------------------------------------------------------------
  const [askOnPause, setAskOnPause] = useState(askWhyPaused);
  const [checkInAt, setCheckInAt] = useState<number | null>(null);
  const [distractions, setDistractions] = useState(0);
  const [breakEndsAt, setBreakEndsAt] = useState<number | null>(null);
  const [pauseCount, setPauseCount] = useState(0);
  const [seenState, setSeenState] = useState(player.state);
  if (player.state !== seenState) {
    setSeenState(player.state);
    if (player.state === "playing" && checkInAt !== null) setCheckInAt(null);
    if (player.state === "paused" && (seenState === "playing" || seenState === "buffering")) setPauseCount((n) => n + 1);
  }
  const canCheckIn =
    askOnPause && !active && !recapOpen && !revise && breakEndsAt === null && player.state === "paused" && pauseCount > 0;
  const nearEnd = data.video.durationSeconds - now < 5;
  useEffect(() => {
    if (!canCheckIn || nearEnd) return;
    const timer = window.setTimeout(() => {
      if (Date.now() - quietPauseAt.current < QUIET_PAUSE_MS + CHECK_IN_DELAY_MS) return;
      setCheckInAt(Math.floor(getCurrentTime()));
    }, CHECK_IN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [canCheckIn, nearEnd, pauseCount, getCurrentTime]);
  const showCheckIn = checkInAt !== null && canCheckIn;

  // -------------------------------------------------------------------------
  // The student's own marks: saved moments, confusing parts, doubts.
  // -------------------------------------------------------------------------
  const saveMoment = useCallback(
    async (label: string | null, at?: number): Promise<boolean> => {
      const seconds = Math.floor(at ?? getTimestamp());
      const r = await addNote({ videoId, kind: "bookmark", seconds, content: label ?? undefined });
      if (!r.ok) {
        toast.error(r.message);
        return false;
      }
      setNotes((ns) => [...ns, r.note].sort(bySeconds));
      toast.success(`Saved ${formatTimestamp(seconds)}`, { action: { label: "View", onClick: () => openMine("saved") } });
      return true;
    },
    [videoId, getTimestamp, openMine],
  );

  const markWeak = useCallback(
    async (source: "manual" | "doubt", label: string | null, at?: number): Promise<boolean> => {
      const t = Math.floor(at ?? getTimestamp());
      const chapter = chapters.length > 0 ? chapterAt(chapters, t) : null;
      const r = await addWeakSpot({
        videoId,
        chapterPosition: chapter?.position ?? null,
        label: (label ?? (source === "doubt" ? `Doubt at ${formatTimestamp(t)}` : `Confusing at ${formatTimestamp(t)}`)).slice(0, 200),
        source,
        ...doubtRange(t, chapter),
      });
      if (!r.ok) {
        toast.error(r.message);
        return false;
      }
      addSpot(r.spot);
      if (source === "manual") toast.success("Marked as a weak spot", { action: { label: "View", onClick: () => openMine("weak") } });
      return true;
    },
    [chapters, videoId, getTimestamp, addSpot, openMine],
  );

  // B saves the moment, like the player's own shortcuts (never while typing).
  useEffect(() => {
    if (!playerReady) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.key.toLowerCase() !== "b") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      event.preventDefault();
      void saveMoment(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playerReady, saveMoment]);

  const askDoubt = (question: string | null) => {
    const t = checkInAt ?? Math.floor(getTimestamp());
    const chapter = chapters.length > 0 ? chapterAt(chapters, t) : null;
    void markWeak("doubt", question, t);
    setCheckInAt(null);
    setRecapOpen(false);
    setTab("tutor");
    tutor.ask(
      question
        ? { message: question, mode: "ask", chapterPosition: chapter?.position, timestampSeconds: t }
        : {
            message: `I'm lost at ${formatTimestamp(t)}`,
            mode: "explain_differently",
            style: "simpler",
            quickAction: "lost",
            chapterPosition: chapter?.position,
            timestampSeconds: t,
          },
    );
  };

  // -------------------------------------------------------------------------

  const selectChapter = (chapter: ChapterPublic) => {
    seek(seekTarget(chapter.startSeconds));
    setManual(null);
  };

  const retry = async (chapterPosition?: number) => {
    setRetrying(chapterPosition ?? "lesson");
    await requestJson(`/api/lessons/${videoId}/retry`, RetryResponseSchema, {
      body: { language, ...(chapterPosition !== undefined ? { chapterPosition } : {}) },
    });
    await refresh();
    setRetrying(null);
  };

  const recordAnswer = (chapter: ChapterPublic, questionId: string, result: AttemptResult) => {
    setLocalAttempts((prev) => (prev[questionId] ? prev : { ...prev, [questionId]: { isCorrect: result.isCorrect } }));
    // A missed checkpoint is a weak spot (once per chapter while it's open).
    if (!result.isCorrect && !attempts[questionId] && chapter.checkpoint) {
      void addWeakSpot({
        videoId,
        chapterPosition: chapter.position,
        label: chapter.checkpoint.concept.slice(0, 200),
        source: "checkpoint",
        ...checkpointRange(chapter),
      }).then((r) => {
        if (r.ok) addSpot(r.spot);
      });
    }
  };

  /** Wrong answer → the tutor, with the question and the chosen answer as the message (Section 5.7). */
  const explainCheckpoint = (chapter: ChapterPublic, result: AttemptResult, selectedIndex: number) => {
    const q = chapter.checkpoint;
    if (!q) return;
    checkpoints.close();
    setTab("tutor");
    tutor.ask({
      message: [
        "I got this checkpoint question wrong.",
        `Question: ${q.prompt}`,
        `I chose: ${q.options[selectedIndex]}`,
        `The correct answer is: ${q.options[result.correctIndex]}`,
        "Explain the idea differently.",
      ].join("\n"),
      mode: "explain_differently",
      style: defaultStyle,
      chapterPosition: chapter.position,
      timestampSeconds: Math.max(chapter.startSeconds, chapter.endSeconds - 1),
    });
  };

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const transcriptAction = (
    <TranscriptDialog
      videoUrl={videoUrl}
      language={language}
      onCreated={() => {
        void refresh();
        router.refresh();
      }}
    />
  );

  const explainChapter = (position: number) => {
    const chapter = chapters.find((c) => c.position === position);
    if (!chapter) return;
    setRecapOpen(false);
    setTab("tutor");
    tutor.ask({
      message: `Explain chapter ${position + 1}, "${chapter.title}", differently. I got its checkpoint wrong.`,
      mode: "explain_differently",
      style: defaultStyle,
      chapterPosition: position,
      timestampSeconds: Math.floor((chapter.startSeconds + chapter.endSeconds) / 2),
    });
  };

  const quizOn = (position: number) => {
    setRecapOpen(false);
    setTab("practice");
    setPracticeView("quiz");
    setQuizPreset((prev) => ({ position, key: (prev?.key ?? 0) + 1 }));
  };

  const checkpointTotal = chapters.filter((c) => c.checkpoint).length;
  const checkpointsAnswered = chapters.filter((c) => c.checkpoint && attempts[c.checkpoint.id]).length;
  const chaptersHeading = (
    <SectionHeading
      className="mb-3"
      meta={
        checkpointTotal > 0 ? (
          <span className="font-mono text-[0.75rem] text-faint tabular-nums">
            {checkpointsAnswered}/{checkpointTotal} checkpoints
          </span>
        ) : null
      }
    >
      Chapters
    </SectionHeading>
  );

  const chapterList =
    chapters.length > 0 ? (
      <ChapterList
        chapters={chapters}
        attempts={attempts}
        currentPosition={currentPosition}
        selectedPosition={selectedPosition}
        onSelect={selectChapter}
        onRetry={(p) => void retry(p)}
        retrying={typeof retrying === "number" ? retrying : null}
        onOpenCheckpoint={pauseForCheckpoints ? undefined : checkpoints.open}
        onOpenRecap={lesson?.chapters.some((c) => c.checkpoint) ? () => setRecapOpen(true) : undefined}
      />
    ) : null;

  const canOpenRecap = lesson !== undefined && !activeQuestion;
  const journeyAction =
    data.status === "failed" && data.progress.chaptersTotal === 0 ? (
      <>
        <Button type="button" size="sm" onClick={() => void retry()} disabled={retrying === "lesson"}>
          {retrying === "lesson" ? <ProgressActivityIcon className="animate-spin motion-reduce:animate-none" /> : <RefreshIcon />}
          <MorphText>{retrying === "lesson" ? "Retrying…" : "Retry"}</MorphText>
        </Button>
        {transcriptAction}
      </>
    ) : stalled && isBuilding(data) ? (
      <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
        <RefreshIcon />
        Check again
      </Button>
    ) : null;

  const weakCount = topics.length;
  const savedCount = notes.length;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="grid min-w-0 gap-6">
        {/* The player. Nothing is ever drawn over it (Section 5.2). */}
        <div className="sticky top-14 z-20 -mx-4 bg-background md:mx-0 md:-mt-4 md:pt-4">
          <div className="relative aspect-video overflow-hidden bg-black md:rounded-2xl md:ring-1 md:ring-border">
            <div ref={mountPlayer} className="absolute inset-0 [&_iframe]:size-full" />
          </div>
          {chapters.length > 0 ? (
            <div className="px-4 pt-4 md:px-0">
              <ChapterTimeline
                chapters={chapters}
                attempts={attempts}
                durationSeconds={data.video.durationSeconds}
                time={now}
                currentPosition={currentPosition}
                playing={player.state === "playing"}
                weakRanges={weakRanges}
                moments={moments}
              />
            </div>
          ) : null}
          <div className="grid gap-2 px-4 pt-3 pb-3 md:px-0">
            <PlayerBar
              videoId={videoId}
              chapters={chapters}
              durationSeconds={data.video.durationSeconds}
              time={now}
              onSeek={seek}
              onSaveMoment={(label) => saveMoment(label)}
              onMarkConfusing={() => markWeak("manual", null)}
              revise={revise}
              onSkipRevise={skipRevise}
              onStopRevise={() => setRevise(null)}
              breakEndsAt={breakEndsAt}
              onEndBreak={() => {
                setBreakEndsAt(null);
                play();
              }}
            />
            {showCheckIn ? (
              <PauseCheckIn
                videoId={videoId}
                lessonTitle={data.video.title}
                time={checkInAt ?? now}
                durationSeconds={data.video.durationSeconds}
                distractions={distractions}
                onDoubt={askDoubt}
                onDistracted={() => setDistractions((n) => n + 1)}
                onRewind={() => {
                  setCheckInAt(null);
                  seek(Math.max(0, (checkInAt ?? now) - 30));
                  play();
                }}
                onNotes={() => {
                  setCheckInAt(null);
                  openMine("saved");
                  setNoteFocus((n) => n + 1);
                }}
                onSaveSpot={() => saveMoment("Stopped here for a break", checkInAt ?? undefined)}
                onStartBreak={() => {
                  setCheckInAt(null);
                  setDistractions(0);
                  setBreakEndsAt(Date.now() + BREAK_MINUTES * 60_000);
                }}
                onDismiss={() => setCheckInAt(null)}
                onStopAsking={() => {
                  setAskOnPause(false);
                  setCheckInAt(null);
                  toast("Won't ask for this lecture. You can turn it off everywhere in Settings.");
                }}
              />
            ) : null}
          </div>
        </div>
        {playerError ? (
          <p role="alert" className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-destructive">
            {playerError}
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-foreground underline decoration-foreground/30 underline-offset-4 transition-[text-decoration-color] duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:decoration-foreground"
            >
              Open on YouTube
              <OpenInNewIcon className="size-4" />
            </a>
          </p>
        ) : null}

        <header className="enter grid gap-2">
          {lesson?.source === "fixture" || lesson?.source === "transcript_paste" ? (
            <div className="flex flex-wrap items-center gap-2">
              {lesson.source === "fixture" ? (
                <span className="inline-flex h-5 items-center rounded-[5px] bg-highlight px-1.5 text-[0.6875rem] font-medium text-highlight-foreground">
                  Test fixture
                </span>
              ) : null}
              {lesson.source === "transcript_paste" ? (
                <span className="inline-flex h-5 items-center rounded-[5px] border px-1.5 text-[0.6875rem] text-muted-foreground">
                  Built from transcript
                </span>
              ) : null}
            </div>
          ) : null}
          <h1 className="text-2xl leading-tight font-semibold tracking-[-0.02em] text-balance">{data.video.title}</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            {[data.video.channelTitle, formatDuration(data.video.durationSeconds), `Notes in ${OUTPUT_LANGUAGE_NAMES[language]}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {chapters.some((c) => c.status === "ready") ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/app/lesson/${videoId}/sheet?lang=${language}`}>
                  <DescriptionIcon />
                  Exam sheet
                </Link>
              </Button>
            ) : null}
            <ShareButton videoId={videoId} language={language} />
          </div>
        </header>

        {/* Everything from "video checked" to "recap seen", and what is happening right now. */}
        <LessonJourney
          input={{
            data,
            stalled,
            furthestSeconds: furthest,
            ended: player.state === "ended",
            playing: player.state === "playing" || player.state === "buffering",
            checkpointsAnswered,
            recapSeen,
            checkpointOpen: activeQuestion && activeChapter ? activeChapter.position : null,
            currentChapter: current ? { position: current.position, title: current.title } : null,
          }}
          action={journeyAction}
          onStep={canOpenRecap ? { recap: () => setRecapOpen(true) } : undefined}
        />

        {chapterList ? (
          <section aria-label="Chapters" className="enter hidden [--i:1] lg:block">
            {chaptersHeading}
            {chapterList}
          </section>
        ) : null}
      </div>

      <aside
        aria-label="Study panel"
        className="enter min-w-0 [--i:1] lg:sticky lg:top-[4.5rem] lg:-mx-1 lg:max-h-[calc(100svh-6.5rem)] lg:overflow-y-auto lg:overscroll-contain lg:px-1 lg:pb-1 lg:[scrollbar-width:thin]"
      >
        {chapterList ? (
          <section aria-label="Chapters" className="mb-8 lg:hidden">
            {chaptersHeading}
            {chapterList}
          </section>
        ) : null}

        {/* Announces auto-triggered checkpoints; the card itself also takes focus. */}
        <p aria-live="assertive" className="sr-only">
          {activeChapter && active?.trigger === "auto"
            ? `Checkpoint question for chapter ${activeChapter.position + 1}. The video is paused.`
            : ""}
        </p>

        {activeChapter && activeQuestion ? (
          <CheckpointCard
            key={activeQuestion.id}
            videoId={videoId}
            language={language}
            chapter={activeChapter}
            question={activeQuestion}
            paused={active?.trigger === "auto"}
            fixture={lesson?.source === "fixture"}
            durationSeconds={data.video.durationSeconds}
            onSeek={seek}
            onAnswered={(result) => recordAnswer(activeChapter, activeQuestion.id, result)}
            onRewatch={() => {
              checkpoints.close();
              seek(activeChapter.startSeconds);
              play();
            }}
            onExplain={(result, selectedIndex) => explainCheckpoint(activeChapter, result, selectedIndex)}
            onContinue={() => {
              const resume = active?.trigger === "auto";
              checkpoints.close();
              if (resume) play();
            }}
          />
        ) : recapOpen ? (
          <RecapPanel
            videoId={videoId}
            language={language}
            refreshKey={Object.keys(localAttempts).length}
            hasKeyTerms={chapters.some((c) => c.status === "ready" && c.keyTerms.length > 0)}
            onRewatch={(seconds) => {
              setRecapOpen(false);
              seek(seconds);
              play();
            }}
            onExplain={explainChapter}
            onClose={() => setRecapOpen(false)}
          />
        ) : null}

        {/* Kept mounted under the checkpoint and recap so a quiz, a deck or a draft survives them. */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(PANEL_TABS.find((t) => t === v) ?? "notes")}
          className={activeQuestion || recapOpen ? "hidden" : "gap-5"}
        >
          <MorphTabsList value={tab} items={PANEL_TAB_ITEMS} />

          <TabsContent value="notes" className={`${TAB_PANEL} grid gap-4`}>
            {lesson ? (
              <Tabs value={notesView} onValueChange={(v) => setNotesView(v === "find" ? "find" : "chapter")} className="gap-4">
                <MorphTabsList
                  value={notesView}
                  className={SUB_TABS}
                  items={[
                    { value: "chapter", label: "Chapter notes" },
                    { value: "find", label: "Find in lecture" },
                  ]}
                />
                <TabsContent value="chapter" className={TAB_PANEL}>
                  <NotesPanel
                    lesson={lesson}
                    chapter={selected}
                    durationSeconds={data.video.durationSeconds}
                    onSeek={seek}
                    onSelectPosition={(position) => setManual({ position, during: currentPosition })}
                  />
                </TabsContent>
                <TabsContent value="find" className={TAB_PANEL}>
                  <SearchPanel videoId={videoId} language={language} chapters={chapters} onSeek={seek} />
                </TabsContent>
              </Tabs>
            ) : (
              <p className="rounded-2xl border border-dashed p-5 text-sm leading-relaxed text-muted-foreground">
                Notes appear here as each chapter is built. The tutor already works.
              </p>
            )}
          </TabsContent>

          {/* Kept mounted so a half-written question survives switching tabs. */}
          <TabsContent value="tutor" forceMount className={`${TAB_PANEL} data-[state=inactive]:hidden`}>
            <TutorPanel
              videoId={videoId}
              language={language}
              tutor={tutor}
              durationSeconds={data.video.durationSeconds}
              time={now}
              chapterTitle={current?.title ?? null}
              chapterPosition={currentPosition}
              tutorClip={data.capabilities.tutorClip}
              defaultStyle={defaultStyle}
              onSeek={seek}
            />
          </TabsContent>

          {/* Kept mounted so a quiz or a deck in progress survives switching tabs. */}
          <TabsContent value="practice" forceMount className={`${TAB_PANEL} data-[state=inactive]:hidden`}>
            <Tabs value={practiceView} onValueChange={(v) => setPracticeView(v === "cards" ? "cards" : "quiz")} className="gap-4">
              <MorphTabsList
                value={practiceView}
                className={SUB_TABS}
                items={[
                  { value: "quiz", label: "Check yourself" },
                  { value: "cards", label: "Flashcards" },
                ]}
              />
              <TabsContent value="quiz" forceMount className={`${TAB_PANEL} data-[state=inactive]:hidden`}>
                <QuizPanel
                  key={quizPreset?.key ?? 0}
                  preset={quizPreset?.position ?? null}
                  videoId={videoId}
                  language={language}
                  chapters={chapters}
                  currentPosition={currentPosition}
                  durationSeconds={data.video.durationSeconds}
                  onSeek={seek}
                  onWeakSpotsChanged={() => void refreshSpots()}
                  onReviseWeakSpots={() => openMine("weak")}
                />
              </TabsContent>
              <TabsContent value="cards" forceMount className={`${TAB_PANEL} data-[state=inactive]:hidden`}>
                <FlashcardsPanel videoId={videoId} language={language} chapters={chapters} currentPosition={currentPosition} onSeek={seek} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="mine" forceMount className={`${TAB_PANEL} data-[state=inactive]:hidden`}>
            <Tabs value={mineView} onValueChange={(v) => setMineView(v === "weak" ? "weak" : "saved")} className="gap-4">
              <MorphTabsList
                value={mineView}
                className={SUB_TABS}
                items={[
                  { value: "weak", label: <SubLabel text="Weak spots" count={weakCount} /> },
                  { value: "saved", label: <SubLabel text="Notes & moments" count={savedCount} /> },
                ]}
              />
              <TabsContent value="weak" className={TAB_PANEL}>
                <WeakSpotsPanel
                  videoId={videoId}
                  topics={topics}
                  chapters={chapters}
                  durationSeconds={data.video.durationSeconds}
                  onSeek={seek}
                  onRevise={startRevise}
                  onQuiz={quizOn}
                  onResolved={(resolved) => resolved.forEach(addSpot)}
                />
              </TabsContent>
              <TabsContent value="saved" forceMount className={`${TAB_PANEL} data-[state=inactive]:hidden`}>
                <MyNotesPanel videoId={videoId} notes={notes} setNotes={setNotes} time={now} onSeek={seek} focusSignal={noteFocus} />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}

function SubLabel({ text, count }: { text: string; count: number }) {
  return (
    <>
      {text}
      {count > 0 ? <span className="font-mono text-[0.6875rem] text-faint tabular-nums">{count}</span> : null}
    </>
  );
}
