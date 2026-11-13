"use client";

import { useEffect, useMemo, useState } from "react";

import { checkpointMarks, crossedCheckpoint, endedCheckpoint, type CheckpointMark } from "@/lib/checkpoints";
import type { ChapterPublic } from "@/types/contracts";

import type { PlayerState } from "./use-youtube-player";

export type ActiveCheckpoint = CheckpointMark & { trigger: "auto" | "manual" };

/**
 * Fires checkpoints on natural crossings (Section 5.7) and pauses the video for them.
 *
 * Detection compares each new playback sample with the previous one during render (React's
 * "adjust state when a prop changes" pattern), so there is no extra timer: the 500 ms playback
 * clock drives it. The only effect is the `pause()` side effect.
 */
export function useCheckpoints({
  chapters,
  answered,
  time,
  playerState,
  autoPause,
  pause,
}: {
  chapters: ChapterPublic[];
  /** Question IDs this student already answered (from the server, plus this session). */
  answered: ReadonlySet<string>;
  time: number;
  playerState: PlayerState;
  /** The "Pause for checkpoint questions" preference. Off: checkpoints are only opened by hand. */
  autoPause: boolean;
  pause: () => void;
}) {
  const marks = useMemo(() => checkpointMarks(chapters), [chapters]);
  const [sample, setSample] = useState({ time, playerState });
  const [fired, setFired] = useState<ReadonlySet<string>>(() => new Set());
  const [active, setActive] = useState<ActiveCheckpoint | null>(null);

  if (sample.time !== time || sample.playerState !== playerState) {
    setSample({ time, playerState });
    if (autoPause && active === null) {
      const done = new Set([...fired, ...answered]);
      const hit =
        playerState === "ended" && sample.playerState !== "ended"
          ? endedCheckpoint(marks, done)
          : crossedCheckpoint(marks, sample.time, time, done);
      if (hit) {
        setFired(new Set(fired).add(hit.questionId));
        setActive({ ...hit, trigger: "auto" });
      }
    }
  }

  useEffect(() => {
    if (active?.trigger === "auto") pause();
  }, [active, pause]);

  return {
    marks,
    active,
    /** Open a checkpoint by hand (from the chapter list). */
    open: (questionId: string) => {
      const mark = marks.find((m) => m.questionId === questionId);
      if (mark) setActive({ ...mark, trigger: "manual" });
    },
    close: () => setActive(null),
  };
}
