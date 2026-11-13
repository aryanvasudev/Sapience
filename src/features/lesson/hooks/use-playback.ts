"use client";

import { useEffect, useRef, useState } from "react";

import type { OutputLanguage } from "@/config/enums";

import { markLessonOpened, saveProgress } from "../actions";
import type { YouTubePlayerApi } from "./use-youtube-player";

const TICK_MS = 500;
const SAVE_EVERY_MS = 15_000;

/** Current playback time, sampled every 500 ms while playing (also drives checkpoints). */
export function usePlaybackClock(player: YouTubePlayerApi): number {
  const [time, setTime] = useState(0);
  const { state, ready, getCurrentTime } = player;

  useEffect(() => {
    if (!ready) return;
    const sample = () => setTime(getCurrentTime());
    sample();
    if (state !== "playing" && state !== "buffering") return;
    const timer = window.setInterval(sample, TICK_MS);
    return () => window.clearInterval(timer);
  }, [state, ready, getCurrentTime]);

  return time;
}

/** Save the position every 15 s while playing, on pause, and when the tab is hidden. */
export function useProgressSaving(player: YouTubePlayerApi, videoId: string, language: OutputLanguage) {
  const lastSaved = useRef<number | null>(null);
  const { state, ready, getCurrentTime } = player;

  useEffect(() => {
    void markLessonOpened({ videoId, language });
  }, [videoId, language]);

  useEffect(() => {
    if (!ready) return;
    const save = () => {
      const seconds = Math.floor(getCurrentTime());
      if (seconds <= 0 || seconds === lastSaved.current) return;
      lastSaved.current = seconds;
      void saveProgress({ videoId, language, seconds });
    };

    if (state === "paused" || state === "ended") save();
    const timer = state === "playing" ? window.setInterval(save, SAVE_EVERY_MS) : undefined;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [state, ready, getCurrentTime, videoId, language]);
}

/** Space/K toggles play, J/L seek ±10 s — only when focus isn't in a text field (Section 5.2). */
export function usePlayerKeyboard(player: YouTubePlayerApi, enabled = true) {
  const { togglePlay, seekTo, getCurrentTime, ready } = player;
  useEffect(() => {
    if (!enabled || !ready) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      const key = event.key.toLowerCase();
      if (key === " " || key === "k") {
        // Space on a focused button should still press it.
        if (key === " " && target?.closest("button, a, [role='tab'], [role='radio']")) return;
        event.preventDefault();
        togglePlay();
      } else if (key === "j") {
        seekTo(getCurrentTime() - 10);
      } else if (key === "l") {
        seekTo(getCurrentTime() + 10);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, ready, togglePlay, seekTo, getCurrentTime]);
}
