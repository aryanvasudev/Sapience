"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { LightbulbIcon, PlayArrowIcon, ReplayIcon } from "@/components/icons";
import { CheckpointMark } from "@/components/layout/wordmark";
import { AiLabel } from "@/components/shared/ai-label";
import { Button } from "@/components/ui/button";
import type { OutputLanguage } from "@/config/enums";
import { SaveConceptButton } from "@/features/revision/components/save-concept-button";
import type { AttemptResult, ChapterPublic, QuestionPublic } from "@/types/contracts";

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
  const reduce = useReducedMotion();
  const [answered, setAnswered] = useState(false);
  useEffect(() => {
    ref.current?.focus();
  }, [question.id]);

  return (
    <motion.section
      ref={ref}
      tabIndex={-1}
      aria-labelledby="checkpoint-title"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="grid gap-5 rounded-2xl border bg-card p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
    >
      <header className="grid gap-1.5">
        <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
          <CheckpointMark className="size-2" />
          Checkpoint · chapter <span className="font-mono tabular-nums">{chapter.position + 1}</span>
        </p>
        <h2 id="checkpoint-title" className="text-[0.9375rem] leading-snug font-medium">
          {chapter.title}
        </h2>
        {paused ? <p className="text-[0.8125rem] text-faint">The video is paused. Answer, or skip and keep watching.</p> : null}
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

      <div className="flex min-h-7 items-center justify-between gap-3 border-t pt-4">
        <AiLabel fixture={fixture} className="text-faint" />
        {answered ? null : (
          <Button type="button" size="xs" variant="ghost" onClick={onContinue} className="text-muted-foreground">
            Skip for now
          </Button>
        )}
      </div>
    </motion.section>
  );
}
