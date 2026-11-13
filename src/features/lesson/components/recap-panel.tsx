"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import {
  CloseIcon,
  DescriptionIcon,
  EventRepeatIcon,
  LibraryAddIcon,
  LightbulbIcon,
  ProgressActivityIcon,
  ReplayIcon,
} from "@/components/icons";
import { CheckpointMark } from "@/components/layout/wordmark";
import { CountUp } from "@/components/motion/count-up";
import { Button } from "@/components/ui/button";
import type { OutputLanguage } from "@/config/enums";
import { requestJson } from "@/lib/client-api";
import { formatTimestamp } from "@/lib/format";
import { KeyTermsResponseSchema, RecapSchema, type Recap } from "@/types/contracts";

import { CheckpointDiamond } from "./chapter-list";

/**
 * End-of-lesson recap (Section 5.11). No AI: counts come from this student's first attempts.
 * Wording stays modest: "Worth reviewing", never "mastered".
 */
export function RecapPanel({
  videoId,
  language,
  refreshKey,
  onRewatch,
  onExplain,
  onClose,
  hasKeyTerms,
}: {
  videoId: string;
  language: OutputLanguage;
  /** Whether any ready chapter has key terms (hides "Add all key terms" otherwise). */
  hasKeyTerms: boolean;
  /** Changes when the student answers something, so the counts are fresh. */
  refreshKey: number;
  onRewatch: (seconds: number) => void;
  onExplain: (position: number) => void;
  onClose: () => void;
}) {
  const [recap, setRecap] = useState<Recap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const controller = new AbortController();
    void requestJson(`/api/lessons/${videoId}/recap?lang=${language}`, RecapSchema, { signal: controller.signal }).then((r) => {
      if (controller.signal.aborted) return;
      if (r.ok) setRecap(r.data);
      else setError(r.message);
    });
    return () => controller.abort();
  }, [videoId, language, refreshKey, reload]);

  return (
    <motion.section
      aria-labelledby="recap-title"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="grid gap-5 rounded-2xl border bg-card p-5 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
    >
      <header className="-my-1 -mr-1.5 flex items-center justify-between gap-3">
        <h2 id="recap-title" className="flex items-center gap-2.5 text-[0.9375rem] font-medium">
          <CheckpointMark className="size-2" />
          Lesson recap
        </h2>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={onClose}
          aria-label="Close the recap"
        >
          <CloseIcon />
        </Button>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : !recap ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ProgressActivityIcon className="size-4.5 animate-spin motion-reduce:animate-none" />
          Adding up your answers…
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border">
            <Stat
              label="Answered"
              value={
                <>
                  <CountUp value={recap.checkpoints.answered} />{" "}
                  <span className="text-[0.8125rem] font-normal tracking-normal text-faint">of {recap.checkpoints.total}</span>
                </>
              }
            />
            <Stat label="Right first time" value={<CountUp value={recap.checkpoints.correct} />} />
            <Stat label="Saved to revise" value={<CountUp value={recap.savedConcepts.length} />} />
          </dl>

          {recap.worthReviewing.length > 0 ? (
            <section aria-labelledby="recap-review" className="grid gap-2.5">
              <h3 id="recap-review" className="text-sm font-medium">
                Worth reviewing
              </h3>
              <ul className="grid gap-2">
                {recap.worthReviewing.map((c) => (
                  <li key={c.position} className="grid gap-2.5 rounded-[10px] border bg-background p-3">
                    <p className="flex items-center gap-2.5 text-sm">
                      <CheckpointDiamond state="wrong" />
                      <span className="min-w-0 flex-1">
                        <span className="font-mono text-[0.8125rem] text-faint tabular-nums">{c.position + 1}</span> {c.title}
                      </span>
                      <span className="font-mono text-[0.75rem] text-faint tabular-nums">{formatTimestamp(c.startSeconds)}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="xs" variant="outline" onClick={() => onRewatch(c.startSeconds)}>
                        <ReplayIcon />
                        Rewatch
                      </Button>
                      <Button type="button" size="xs" variant="outline" onClick={() => onExplain(c.position)}>
                        <LightbulbIcon />
                        Explain differently
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : recap.checkpoints.answered > 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">Every checkpoint you answered, you got right the first time.</p>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">You haven&apos;t answered any checkpoints in this lecture yet.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/app/lesson/${videoId}/sheet?lang=${language}`}>
                <DescriptionIcon />
                Exam sheet
              </Link>
            </Button>
            {hasKeyTerms ? (
              <AddKeyTerms videoId={videoId} language={language} onAdded={() => setReload((n) => n + 1)} />
            ) : null}
          </div>

          {recap.savedConcepts.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-[0.8125rem] text-muted-foreground">
                {recap.conceptsDue > 0 ? `${recap.conceptsDue} due for review now` : "Nothing from this lecture is due right now"}
              </p>
              <Button asChild size="sm">
                <Link href="/app/revision?start=1">
                  <EventRepeatIcon />
                  Start revision
                </Link>
              </Button>
            </div>
          ) : null}
        </>
      )}
    </motion.section>
  );
}

function AddKeyTerms({ videoId, language, onAdded }: { videoId: string; language: OutputLanguage; onAdded: () => void }) {
  const [state, setState] = useState<{ status: "idle" | "saving" } | { status: "done" | "error"; message: string }>({
    status: "idle",
  });
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={state.status === "saving"}
        onClick={async () => {
          setState({ status: "saving" });
          const r = await requestJson("/api/concepts/key-terms", KeyTermsResponseSchema, { body: { youtubeVideoId: videoId, language } });
          if (!r.ok) return setState({ status: "error", message: r.message });
          const { added, alreadySaved } = r.data;
          setState({
            status: "done",
            message:
              added === 0
                ? "Every key term is already in revision."
                : `Added ${added} key ${added === 1 ? "term" : "terms"}${alreadySaved ? ` (${alreadySaved} already saved)` : ""}. First review tomorrow.`,
          });
          if (added > 0) onAdded();
        }}
      >
        {state.status === "saving" ? <ProgressActivityIcon className="animate-spin motion-reduce:animate-none" /> : <LibraryAddIcon />}
        Add all key terms to revision
      </Button>
      {state.status === "done" || state.status === "error" ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "w-full animate-fade text-sm text-destructive"
              : "w-full animate-fade text-[0.8125rem] text-muted-foreground"
          }
        >
          {state.message}
        </p>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5 bg-card p-3">
      <dt className="order-2 text-[0.75rem] leading-snug text-muted-foreground">{label}</dt>
      <dd className="order-1 text-xl leading-none font-semibold tracking-[-0.02em] tabular-nums">{value}</dd>
    </div>
  );
}
