"use client";

/**
 * Poll GET /api/lessons/[videoId] while the lesson is being built (Section 5.4): every 3 s, every
 * 5 s once the outline exists, and stop after 8 minutes (the UI then offers Retry).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { OutputLanguage } from "@/config/enums";
import { LessonStatusResponseSchema, type LessonStatusResponse } from "@/types/contracts";

const FAST_MS = 3000;
const SLOW_MS = 5000;
const GIVE_UP_MS = 8 * 60 * 1000;

export function isBuilding(status: LessonStatusResponse): boolean {
  if (status.status === "queued" || status.status === "outlining" || status.status === "building") return true;
  return status.lesson?.chapters.some((c) => c.status === "pending") ?? false;
}

export function useLessonStatus(initial: LessonStatusResponse, videoId: string, language: OutputLanguage) {
  const [data, setData] = useState(initial);
  const [stalled, setStalled] = useState(false);
  const [pollKey, setPollKey] = useState(0);
  const startedAt = useRef<number | null>(null);

  const fetchOnce = useCallback(async () => {
    const response = await fetch(`/api/lessons/${videoId}?lang=${language}`, { cache: "no-store" });
    if (!response.ok) return null;
    const parsed = LessonStatusResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  }, [videoId, language]);

  const building = isBuilding(data);
  const hasOutline = (data.lesson?.chapters.length ?? 0) > 0;

  useEffect(() => {
    if (!building) return;
    startedAt.current ??= Date.now();
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (Date.now() - (startedAt.current ?? Date.now()) > GIVE_UP_MS) {
        setStalled(true);
        return;
      }
      const next = await fetchOnce().catch(() => null);
      if (!cancelled && next) setData(next);
      else if (!cancelled) setPollKey((k) => k + 1);
    }, hasOutline ? SLOW_MS : FAST_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [building, hasOutline, fetchOnce, data, pollKey]);

  /** Fetch now and restart polling (after a retry, or after "stalled"). */
  const refresh = useCallback(async () => {
    startedAt.current = Date.now();
    setStalled(false);
    const next = await fetchOnce().catch(() => null);
    if (next) setData(next);
    else setPollKey((k) => k + 1);
  }, [fetchOnce]);

  return { data, setData, stalled, refresh };
}
