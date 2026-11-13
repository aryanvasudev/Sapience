"use client";

import { useEffect, useRef, useState } from "react";

import { LightbulbIcon, PlayArrowIcon, ReplayIcon } from "@/components/icons";
import { AiLabel } from "@/components/shared/ai-label";
import { Button } from "@/components/ui/button";
import type { OutputLanguage } from "@/config/enums";
import { SaveConceptButton } from "@/features/revision/components/save-concept-button";
import type { AttemptResult, ChapterPublic, QuestionPublic } from "@/types/contracts";

import { CheckpointDiamond } from "./chapter-list";
import { QuestionCard } from "./question-card";

/**
 * The checkpoint question at the end of a chapter (Section 5.7). Shown beside the player, never
 * over it. Takes focus when it opens so keyboard and screen-reader users land on it.
 */
export function CheckpointCard({
  videoId,
  language,
  chapter,
  question,
  paused,
  fixture,
  durationSeconds,
  onSeek,
  onAnswered,
  onRewatch,
  onExplain,
  onContinue,
}: {
  videoId: string;
  language: OutputLanguage;
  chapter: ChapterPublic;
  question: QuestionPublic;
  /** The video was paused for this checkpoint (so Continue resumes it). */
  paused: boolean;
  fixture: boolean;
  durationSeconds: number;
  onSeek: (seconds: number) => void;
  onAnswered: (result: AttemptResult) => void;
  onRewatch: () => void;
  onExplain: (result: AttemptResult, selectedIndex: number) => void;
  onContinue: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [answered, setAnswered] = useState(false);
  useEffect(() => {
    ref.current?.focus();
  }, [question.id]);

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby="checkpoint-title"
      className="grid gap-5 rounded-xl border border-foreground/12 bg-card p-5 shadow-[0_1px_0_0_var(--rule)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <header className="grid gap-1">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <CheckpointDiamond state="open" />
          Checkpoint · Chapter {chapter.position + 1}
        </p>
        <h2 id="checkpoint-title" className="font-serif text-base leading-snug font-medium">
          {chapter.title}
        </h2>
        {paused ? <p className="text-xs text-muted-foreground">The video is paused. Answer, or skip and keep watching.</p> : null}
      </header>

      <QuestionCard
        question={question}
        durationSeconds={durationSeconds}
        onSeek={onSeek}
        onResult={(result) => {
          setAnswered(true);
          onAnswered(result);
        }}
        actions={(result, selectedIndex) => (
          <>
            {!result.isCorrect ? (
              <>
                <Button type="button" size="sm" variant="outline" onClick={onRewatch}>
                  <ReplayIcon />
                  Rewatch this part
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onExplain(result, selectedIndex)}>
                  <LightbulbIcon />
                  Explain differently
                </Button>
              </>
            ) : null}
            <SaveConceptButton
              concept={{
                youtubeVideoId: videoId,
                language,
                sourceSeconds: chapter.startSeconds,
                title: question.concept,
                questionId: question.id,
                source: "checkpoint",
              }}
            />
            <Button type="button" size="sm" onClick={onContinue}>
              <PlayArrowIcon />
              Continue
            </Button>
          </>
        )}
      />

      <div className="flex items-center justify-between gap-3">
        <AiLabel fixture={fixture} />
        {answered ? null : (
          <Button type="button" size="xs" variant="ghost" onClick={onContinue} className="text-muted-foreground">
            Skip for now
          </Button>
        )}
      </div>
    </section>
  );
}

