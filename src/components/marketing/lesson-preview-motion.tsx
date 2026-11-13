"use client";

import { useEffect, useRef, useState } from "react";

import { PauseCircleIcon, PlayCircleIcon, ReplayIcon } from "@/components/icons";
import { CheckpointMark } from "@/components/layout/wordmark";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * One explanatory animation (Emil Kowalski: "explanation" is a valid purpose; marketing motion
 * can run longer). It plays once when scrolled into view: the playhead runs to the end of the
 * chapter, the video pauses, and the checkpoint question rises in. No loop; "Replay" restarts it.
 * Reduced motion: the paused end state is shown immediately.
 */

const DURATION = 48 * 60;
const CHAPTERS = [
  { title: "Why polymers matter", end: 6 * 60 },
  { title: "Monomers and repeat units", end: 15 * 60 },
  { title: "Degree of polymerization", end: 27 * 60 },
  { title: "Addition and condensation", end: 39 * 60 },
  { title: "Properties and uses", end: 48 * 60 },
].map((c, i, all) => ({ ...c, start: all[i - 1]?.end ?? 0 }));
const CURRENT = 2;
const FROM = 23 * 60 + 40;
const TO = CHAPTERS[CURRENT]?.end ?? 27 * 60;
const PLAY_MS = 1600;

const OPTIONS = ["200", "2,000", "1,568,000", "28"];

type Phase = "idle" | "playing" | "paused";

export function LessonPreviewMotion({ formulaHtml, workingHtml }: { formulaHtml: string; workingHtml: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const frame = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  const place = (seconds: number) => {
    if (headRef.current) headRef.current.style.transform = `translateX(${(seconds / DURATION) * 100}%)`;
    if (timeRef.current) timeRef.current.textContent = formatTimestamp(seconds);
  };

  const play = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      place(TO);
      setPhase("paused");
      return;
    }
    setPhase("playing");
    const startedAt = performance.now();
    const tick = (now: number) => {
      // Playback is constant motion, so it is linear.
      const t = Math.min(1, (now - startedAt) / PLAY_MS);
      place(FROM + (TO - FROM) * t);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else {
        frame.current = null;
        setPhase("paused");
      }
    };
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    place(FROM);
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          play();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
    // play/place only touch refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paused = phase === "paused";

  return (
    <figure className="w-full">
      <p className="sr-only">
        Example lesson: a 48-minute lecture on polymers, split into five chapters. At the end of the chapter
        “Degree of polymerization” the video pauses and asks: a polymer has number-average molar mass 56,000 g/mol
        and repeat-unit molar mass 28 g/mol, what is its degree of polymerization?
      </p>

      <div
        ref={rootRef}
        aria-hidden
        className="rounded-[18px] border bg-card p-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_24px_48px_-24px_rgb(0_0_0/0.22)] dark:shadow-[0_24px_48px_-24px_rgb(0_0_0/0.9)]"
      >
        <div className="flex items-baseline justify-between gap-4 px-2 pt-1 pb-3">
          <span className="truncate text-sm font-medium">Introduction to polymers</span>
          <span className="shrink-0 text-xs text-muted-foreground">Example lesson</span>
        </div>

        {/* The lecturer's board, as the AI reads it. Nothing is drawn over it. */}
        <div className="relative flex aspect-[4/3] flex-col overflow-hidden rounded-[10px] bg-board min-[480px]:aspect-video px-5 pt-4 pb-6 text-chalk sm:px-8 sm:pt-6">
          <span className="font-serif text-sm text-chalk-muted sm:text-base">Degree of polymerization</span>
          <div className="flex flex-1 flex-col items-center justify-center gap-1 [&_.katex-display]:my-0">
            <div className="text-[1.35rem] sm:text-[1.9rem]" dangerouslySetInnerHTML={{ __html: formulaHtml }} />
            <div className="text-[0.95rem] text-chalk-muted sm:text-[1.15rem]" dangerouslySetInnerHTML={{ __html: workingHtml }} />
          </div>
          <span className="absolute inset-x-0 bottom-0 h-1.5 bg-black/25" />
        </div>

        <div className="px-2 pt-4">
          <div className="relative">
            <ol className="flex h-9 overflow-visible rounded-md border bg-background">
              {CHAPTERS.map((c, i) => (
                <li
                  key={c.title}
                  className={cn(
                    "relative min-w-0 border-border not-last:border-r",
                    i === CURRENT && "bg-accent",
                  )}
                  style={{ width: `${((c.end - c.start) / DURATION) * 100}%` }}
                >
                  <span
                    className={cn(
                      "absolute -top-[6px] -right-[6px] z-[2] size-3 rotate-45 rounded-[2px] border shadow-[0_0_0_3px_var(--card)] transition-[background-color,border-color] duration-200 ease-(--ease-out)",
                      i < CURRENT || (i === CURRENT && paused)
                        ? "border-sapphire bg-sapphire"
                        : "border-foreground/30 bg-card",
                    )}
                  />
                </li>
              ))}
            </ol>
            {/* The moving layer is full-width and translated by a percentage, so clip it horizontally. */}
            <div className="pointer-events-none absolute inset-x-0 inset-y-[-4px] z-[1] overflow-x-clip">
              <div ref={headRef} className="h-full w-full will-change-transform">
                <span className="block h-full w-0.5 -translate-x-1/2 rounded-full bg-primary" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className={cn("inline-flex items-center gap-2 transition-colors duration-200 ease-(--ease-out)", paused ? "text-foreground" : "text-muted-foreground")}>
              {paused ? <PauseCircleIcon className="size-4.5" /> : <PlayCircleIcon className="size-4.5" />}
              {paused ? "Paused for a question" : "Playing chapter 3"}
            </span>
            <span className="text-muted-foreground tabular-nums">
              <span ref={timeRef}>{formatTimestamp(FROM)}</span> / {formatTimestamp(DURATION)}
            </span>
          </div>
        </div>

        {/* Space is reserved so nothing jumps when the question arrives. */}
        <div
          data-show={paused}
          className="mx-2 mt-4 mb-2 translate-y-2 rounded-[10px] border bg-background p-4 opacity-0 transition-[opacity,transform] duration-300 ease-(--ease-out) data-[show=true]:translate-y-0 data-[show=true]:opacity-100"
        >
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckpointMark className="size-2" />
            Question before you continue
          </p>
          <p className="mt-2 text-[0.9375rem] leading-snug">
            A polymer has M<sub>n</sub> = 56,000 g/mol and a repeat unit of 28 g/mol. What is its degree of
            polymerization?
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {OPTIONS.map((o) => (
              <span key={o} className="rounded-md border bg-card px-3 py-2 text-center tabular-nums">
                {o}
              </span>
            ))}
          </div>
        </div>
      </div>

      <figcaption className="mt-4 flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <CheckpointMark className="size-2.5" />
          Every chapter ends with a question
        </span>
        <button
          type="button"
          onClick={play}
          disabled={phase === "playing"}
          className="-mr-2 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-[color,opacity] duration-150 ease-(--ease-out) disabled:opacity-0 md:h-9 [@media(hover:hover)]:hover:text-foreground"
        >
          <ReplayIcon className="size-4.5" />
          Replay
        </button>
      </figcaption>
    </figure>
  );
}
