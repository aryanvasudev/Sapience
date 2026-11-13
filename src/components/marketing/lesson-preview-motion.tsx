"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { CheckCircleIcon, ForumIcon, NotesIcon, PauseCircleIcon, PlayCircleIcon, ReplayIcon, SearchIcon } from "@/components/icons";
import { CheckpointMark, LogoMark } from "@/components/layout/wordmark";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * The hero's product window: a Sapience lesson at the moment a checkpoint pauses the video.
 * One explanatory animation (Emil Kowalski: "explanation" is a valid purpose; marketing motion can
 * run longer). It plays once when scrolled into view: the playhead runs to the end of the chapter,
 * the video pauses, the notes panel morphs into the checkpoint question, and the right answer is
 * picked. No loop; "Replay" restarts it. Reduced motion shows the answered end state immediately.
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
const PLAY_MS = 1800;
const ANSWER_DELAY_MS = 1400;

const OPTIONS = ["200", "2,000", "1,568,000", "28"];
const CORRECT = 1;

const NOTES = [
  { at: 15 * 60 + 42, text: "DP counts the repeat units in an average chain" },
  { at: 21 * 60 + 5, text: "Polyethylene repeat unit: M₀ = 28 g/mol" },
  { at: 23 * 60 + 40, text: "28,000 ÷ 28 = 1,000 repeat units" },
];

type Phase = "idle" | "playing" | "paused" | "answered";
const EASE = [0.22, 1, 0.36, 1] as const;

export function LessonPreviewMotion({ formulaHtml, workingHtml }: { formulaHtml: string; workingHtml: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const frame = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const reduce = useReducedMotion();

  const place = (seconds: number) => {
    if (headRef.current) headRef.current.style.transform = `translateX(${(seconds / DURATION) * 100}%)`;
    if (timeRef.current) timeRef.current.textContent = formatTimestamp(seconds);
  };

  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (timer.current !== null) window.clearTimeout(timer.current);
    frame.current = null;
    timer.current = null;
  };

  const play = () => {
    stop();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      place(TO);
      setPhase("answered");
      return;
    }
    place(FROM);
    setPhase("playing");
    const startedAt = performance.now();
    const tick = (now: number) => {
      // Playback is constant motion, so it is linear.
      const t = Math.min(1, (now - startedAt) / PLAY_MS);
      place(FROM + (TO - FROM) * t);
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      frame.current = null;
      setPhase("paused");
      timer.current = window.setTimeout(() => setPhase("answered"), ANSWER_DELAY_MS);
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
          timer.current = window.setTimeout(play, 500);
        }
      },
      { threshold: 0.45 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      stop();
    };
    // play/place/stop only touch refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paused = phase === "paused" || phase === "answered";
  const answered = phase === "answered";

  return (
    <figure className="w-full">
      <p className="sr-only">
        Example lesson: a 48-minute lecture on polymers, split into five chapters. At the end of the chapter
        “Degree of polymerization” the video pauses and asks: a polymer has number-average molar mass 56,000 g/mol
        and repeat-unit molar mass 28 g/mol, what is its degree of polymerization? The answer is 2,000.
      </p>

      <div
        ref={rootRef}
        aria-hidden
        className="rounded-[20px] border border-black/10 bg-black/[0.03] p-1.5 shadow-[0_40px_100px_-40px_rgb(0_0_0/0.25)] backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_40px_120px_-40px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.06)]"
      >
        <div className="overflow-hidden rounded-[14px] border bg-background">
          {/* Title bar */}
          <div className="flex h-11 items-center gap-3 border-b px-3.5">
            <LogoMark className="size-5 rounded-[6px]" />
            <span className="truncate text-[0.8125rem] font-medium">Introduction to polymers</span>
            <span className="hidden text-[0.8125rem] text-faint sm:inline">Chemistry lecture · 48 min</span>
            <span className="ml-auto shrink-0 font-mono text-[0.6875rem] text-faint">Example lesson</span>
          </div>

          <div className="grid md:grid-cols-[minmax(0,1fr)_19rem] lg:grid-cols-[minmax(0,1fr)_21rem]">
            {/* Player column */}
            <div className="min-w-0 p-3 sm:p-4">
              <div className="relative flex aspect-video flex-col overflow-hidden rounded-[10px] bg-board px-5 pt-4 pb-6 text-chalk ring-1 ring-white/5 sm:px-8 sm:pt-6">
                <span className="text-[0.8125rem] text-chalk-muted sm:text-sm">Degree of polymerization</span>
                <div className="flex flex-1 flex-col items-center justify-center gap-1 [&_.katex-display]:my-0">
                  <div className="text-[1.3rem] sm:text-[1.9rem]" dangerouslySetInnerHTML={{ __html: formulaHtml }} />
                  <div className="text-[0.9rem] text-chalk-muted sm:text-[1.1rem]" dangerouslySetInnerHTML={{ __html: workingHtml }} />
                </div>
                <AnimatePresence>
                  {paused ? (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-[0.6875rem] text-chalk backdrop-blur-sm"
                    >
                      <PauseCircleIcon className="size-3.5" />
                      Paused
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>

              {/* Timeline */}
              <div className="relative mt-4">
                <ol className="flex h-2 gap-1">
                  {CHAPTERS.map((c, i) => (
                    <li
                      key={c.title}
                      className="relative min-w-0 rounded-full bg-muted"
                      style={{ width: `${((c.end - c.start) / DURATION) * 100}%` }}
                    >
                      {i < CURRENT ? <span className="absolute inset-0 rounded-full bg-foreground/35" /> : null}
                      <span
                        className={cn(
                          "absolute top-1/2 -right-[5px] z-[2] size-2.5 -translate-y-1/2 rotate-45 rounded-[2px] shadow-[0_0_0_3px_var(--background)] transition-colors duration-300 ease-(--ease-out)",
                          i < CURRENT || (i === CURRENT && paused) ? "bg-brand" : "bg-foreground/25",
                        )}
                      />
                    </li>
                  ))}
                </ol>
                {/* The moving layer is full-width and translated by a percentage, so clip it horizontally. */}
                <div className="pointer-events-none absolute inset-x-0 -inset-y-1.5 z-[3] overflow-x-clip">
                  <div ref={headRef} className="h-full w-full will-change-transform">
                    <span className="block h-full w-[3px] -translate-x-1/2 rounded-full bg-brand shadow-[0_0_0_2px_var(--background)]" />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-[0.8125rem]">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="relative grid size-4.5 place-items-center">
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        key={paused ? "pause" : "play"}
                        initial={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
                        transition={{ duration: 0.18, ease: EASE }}
                        className={paused ? "text-brand-ink" : "text-muted-foreground"}
                      >
                        {paused ? <PauseCircleIcon className="size-4.5" /> : <PlayCircleIcon className="size-4.5" />}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  <span className="truncate">
                    <span className="text-faint">Chapter 3 · </span>
                    {CHAPTERS[CURRENT]?.title}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[0.75rem] text-muted-foreground tabular-nums">
                  <span ref={timeRef}>{formatTimestamp(FROM)}</span> / {formatTimestamp(DURATION)}
                </span>
              </div>
            </div>

            {/* Study panel */}
            <div className="flex min-w-0 flex-col border-t p-3 sm:p-4 md:border-t-0 md:border-l">
              <div className="flex h-9 items-center gap-0.5 rounded-[10px] border bg-surface p-1 text-[0.75rem] font-medium">
                {[
                  { label: "Tutor", icon: ForumIcon, on: false },
                  { label: "Notes", icon: NotesIcon, on: !paused },
                  { label: "Search", icon: SearchIcon, on: false },
                ].map(({ label, icon: Icon, on }) => (
                  <span
                    key={label}
                    className={cn(
                      "relative inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-md transition-colors duration-200 ease-(--ease-out)",
                      on ? "bg-raised text-foreground ring-1 ring-border" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </span>
                ))}
              </div>

              <div className="relative mt-4 min-h-[17.5rem] flex-1">
                <AnimatePresence mode="popLayout" initial={false}>
                  {paused ? (
                    <motion.div
                      key="question"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(6px)", scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45, ease: EASE }}
                      className="rounded-xl border bg-card p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
                    >
                      <p className="flex items-center gap-2 text-[0.75rem] text-muted-foreground">
                        <CheckpointMark className="size-2" />
                        Checkpoint · chapter 3
                      </p>
                      <p className="mt-2.5 text-[0.875rem] leading-snug">
                        A polymer has M<sub>n</sub> = 56,000 g/mol and a repeat unit of 28 g/mol. What is its degree of
                        polymerization?
                      </p>
                      <div className="mt-3.5 grid grid-cols-2 gap-1.5 text-[0.8125rem]">
                        {OPTIONS.map((o, i) => {
                          const right = answered && i === CORRECT;
                          return (
                            <span
                              key={o}
                              className={cn(
                                "flex h-9 items-center justify-between gap-2 rounded-lg border px-3 font-mono tabular-nums transition-[background-color,border-color,color] duration-300 ease-(--ease-out)",
                                right ? "border-positive/50 bg-positive/10 text-foreground" : "bg-background",
                                answered && !right && "text-faint",
                              )}
                            >
                              {o}
                              {right ? (
                                <motion.span
                                  initial={{ opacity: 0, scale: 0.6 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ type: "spring", duration: 0.35, bounce: 0.2 }}
                                >
                                  <CheckCircleIcon className="size-4 text-positive" />
                                </motion.span>
                              ) : null}
                            </span>
                          );
                        })}
                      </div>
                      <div className="mt-3 h-10">
                        <AnimatePresence>
                          {answered ? (
                            <motion.p
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, ease: EASE, delay: 0.1 }}
                              className="text-[0.8125rem] leading-snug text-muted-foreground"
                            >
                              <span className="text-foreground">Right.</span> 56,000 ÷ 28 = 2,000 repeat units in an average
                              chain.
                            </motion.p>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="notes"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(6px)" }}
                      transition={{ duration: 0.3, ease: EASE }}
                    >
                      <p className="text-[0.875rem] font-medium">Degree of polymerization</p>
                      <p className="mt-1 text-[0.75rem] text-faint">AI-generated notes · chapter 3</p>
                      <div
                        className="mt-4 rounded-lg border bg-surface px-3 py-2 text-[1.05rem] [&_.katex-display]:my-0"
                        dangerouslySetInnerHTML={{ __html: formulaHtml }}
                      />
                      <ul className="mt-4 grid gap-3">
                        {NOTES.map((n) => (
                          <li key={n.at} className="flex items-start gap-2.5 text-[0.8125rem] leading-snug">
                            <span className="mt-px shrink-0 rounded-[5px] border bg-surface px-1.5 py-px font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
                              {formatTimestamp(n.at)}
                            </span>
                            <span className="text-foreground/85">{n.text}</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-4 flex items-center justify-between gap-4 px-1 text-[0.8125rem] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <CheckpointMark className="size-2" />
          Every chapter ends with a question
        </span>
        <button
          type="button"
          onClick={play}
          disabled={phase === "playing" || phase === "paused"}
          className="-mr-2 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md px-2 transition-[color,opacity] duration-150 ease-(--ease-out) disabled:opacity-0 md:h-9 [@media(hover:hover)]:hover:text-foreground"
        >
          <ReplayIcon className="size-4" />
          Replay
        </button>
      </figcaption>
    </figure>
  );
}
