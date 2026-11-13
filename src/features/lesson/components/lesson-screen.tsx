"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";

import { ForumIcon, NotesIcon, OpenInNewIcon, SearchIcon } from "@/components/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OUTPUT_LANGUAGE_NAMES, type OutputLanguage, type TutorStyle } from "@/config/enums";
import { TutorPanel } from "@/features/tutor/components/tutor-panel";
import { useTutor } from "@/features/tutor/hooks/use-tutor";
import { requestJson } from "@/lib/client-api";
import { formatDuration } from "@/lib/format";
import { seekTarget } from "@/lib/timestamps";
import type { TutorUIMessage } from "@/lib/tutor/types";
import type { AttemptResult, ChapterPublic, LessonStatusResponse } from "@/types/contracts";

import { useCheckpoints } from "../hooks/use-checkpoints";
import { useLessonStatus } from "../hooks/use-lesson-status";
import { usePlaybackClock, usePlayerKeyboard, useProgressSaving } from "../hooks/use-playback";
import { useYouTubePlayer } from "../hooks/use-youtube-player";
import { ChapterList } from "./chapter-list";
import { CheckpointCard } from "./checkpoint-card";
import { LessonStatusBanner } from "./lesson-status-banner";
import { NotesPanel } from "./notes-panel";
import { RecapPanel } from "./recap-panel";
import { SearchPanel } from "./search-panel";
import { TranscriptDialog } from "./transcript-dialog";

const RetryResponseSchema = z.object({ status: z.string() });

export function chapterAt(chapters: ChapterPublic[], seconds: number): ChapterPublic | null {
  return chapters.find((c) => seconds >= c.startSeconds && seconds < c.endSeconds) ?? chapters[chapters.length - 1] ?? null;
}

type PanelTab = "tutor" | "notes" | "search";
const PANEL_TABS: readonly PanelTab[] = ["tutor", "notes", "search"];

export function LessonScreen({
  initial,
  videoId,
  language,
  startSeconds,
  pauseForCheckpoints,
  defaultStyle,
  initialMessages,
}: {
  initial: LessonStatusResponse;
  videoId: string;
  language: OutputLanguage;
  startSeconds: number;
  pauseForCheckpoints: boolean;
  defaultStyle: TutorStyle;
  initialMessages: TutorUIMessage[];
}) {
  const router = useRouter();
  const { data, stalled, refresh } = useLessonStatus(initial, videoId, language);
  const player = useYouTubePlayer(videoId, startSeconds);
  const { mount: mountPlayer, error: playerError, getCurrentTime, ready: playerReady, play, pause } = player;
  const time = usePlaybackClock(player);
  useProgressSaving(player, videoId, language);
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

  // Answers from this session show immediately; the server copy catches up on the next poll.
  const [localAttempts, setLocalAttempts] = useState<LessonStatusResponse["attempts"]>({});
  const attempts = useMemo(() => ({ ...data.attempts, ...localAttempts }), [data.attempts, localAttempts]);
  const answered = useMemo(() => new Set(Object.keys(attempts)), [attempts]);

  const getTimestamp = useCallback(
    () => (playerReady ? getCurrentTime() : startSeconds),
    [playerReady, getCurrentTime, startSeconds],
  );
  const tutor = useTutor({ videoId, language, initialMessages, getTimestamp });

  const checkpoints = useCheckpoints({
    chapters,
    answered,
    time,
    playerState: player.state,
    autoPause: pauseForCheckpoints,
    pause,
  });
  // The recap opens when the video ends (after any final checkpoint) or from the chapter list.
  const [recapOpen, setRecapOpen] = useState(false);
  const [endedSeen, setEndedSeen] = useState(player.state === "ended");
  if ((player.state === "ended") !== endedSeen) {
    setEndedSeen(player.state === "ended");
    if (player.state === "ended" && lesson) setRecapOpen(true);
  }

  const active = checkpoints.active;
  const activeChapter = active ? chapters.find((c) => c.position === active.chapterPosition) : undefined;
  const activeQuestion = activeChapter?.checkpoint ?? null;

  const seek = useCallback((seconds: number) => player.seekTo(seconds), [player]);

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

  const recordAnswer = (questionId: string, result: AttemptResult) =>
    setLocalAttempts((prev) => (prev[questionId] ? prev : { ...prev, [questionId]: { isCorrect: result.isCorrect } }));

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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_27rem]">
      <div className="grid min-w-0 gap-5">
        {/* The player. Nothing is ever drawn over it (Section 5.2). */}
        <div className="sticky top-16 z-20 -mx-4 bg-background md:mx-0 md:pt-1">
          <div className="relative aspect-video overflow-hidden bg-black md:rounded-xl">
            <div ref={mountPlayer} className="absolute inset-0 [&_iframe]:size-full" />
          </div>
        </div>
        {playerError ? (
          <p role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-destructive">
            {playerError}
            <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-foreground underline underline-offset-4">
              Open on YouTube
              <OpenInNewIcon className="size-4" />
            </a>
          </p>
        ) : null}

        <header className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {lesson?.source === "fixture" ? (
              <span className="rounded-md bg-highlight px-2 py-0.5 text-xs font-medium text-highlight-foreground">Test fixture</span>
            ) : null}
            {lesson?.source === "transcript_paste" ? (
              <span className="rounded-md border border-foreground/15 px-2 py-0.5 text-xs text-muted-foreground">
                Built from pasted transcript
              </span>
            ) : null}
          </div>
          <h1 className="font-serif text-2xl leading-snug font-medium tracking-[-0.01em] text-balance">{data.video.title}</h1>
          <p className="text-sm text-muted-foreground">
            {[data.video.channelTitle, formatDuration(data.video.durationSeconds), `Notes in ${OUTPUT_LANGUAGE_NAMES[language]}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </header>

        <LessonStatusBanner
          data={data}
          stalled={stalled}
          onRetryLesson={() => void retry()}
          onRefresh={() => void refresh()}
          retrying={retrying === "lesson"}
          transcriptAction={transcriptAction}
        />

        {chapterList ? (
          <section aria-label="Chapters" className="hidden lg:block">
            {chapterList}
          </section>
        ) : null}
      </div>

      <aside aria-label="Study panel" className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1">
        {chapterList ? <section aria-label="Chapters" className="mb-6 lg:hidden">{chapterList}</section> : null}

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
            onAnswered={(result) => recordAnswer(activeQuestion.id, result)}
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
            onRewatch={(seconds) => {
              setRecapOpen(false);
              seek(seconds);
              play();
            }}
            onExplain={explainChapter}
            onClose={() => setRecapOpen(false)}
          />
        ) : (
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(PANEL_TABS.find((t) => t === v) ?? "notes")}
            className="gap-5"
          >
            <TabsList className="w-full">
              <TabsTrigger value="tutor">
                <ForumIcon />
                Tutor
              </TabsTrigger>
              <TabsTrigger value="notes">
                <NotesIcon />
                Notes
              </TabsTrigger>
              <TabsTrigger value="search">
                <SearchIcon />
                Search
              </TabsTrigger>
            </TabsList>
            {/* Kept mounted so a half-written question survives switching tabs. */}
            <TabsContent value="tutor" forceMount className="data-[state=inactive]:hidden">
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
            <TabsContent value="notes">
              {lesson ? (
                <NotesPanel
                  lesson={lesson}
                  chapter={selected}
                  durationSeconds={data.video.durationSeconds}
                  onSeek={seek}
                  onSelectPosition={(position) => setManual({ position, during: currentPosition })}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Notes appear here as each chapter is built. The tutor already works.</p>
              )}
            </TabsContent>
            <TabsContent value="search">
              <SearchPanel videoId={videoId} language={language} chapters={chapters} onSeek={seek} />
            </TabsContent>
          </Tabs>
        )}
      </aside>
    </div>
  );
}
