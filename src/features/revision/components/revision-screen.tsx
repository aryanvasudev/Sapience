"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { ArrowForwardIcon, CheckCircleIcon, EventRepeatIcon, PlayCircleIcon, ProgressActivityIcon } from "@/components/icons";
import { CheckpointMark } from "@/components/layout/wordmark";
import { CountUp } from "@/components/motion/count-up";
import { AiLabel } from "@/components/shared/ai-label";
import { Markdown } from "@/components/shared/markdown";
import { Button } from "@/components/ui/button";
import { MorphTabsList } from "@/components/ui/morph-tabs";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { RECALL_RATINGS, type RecallRating } from "@/config/enums";
import { QuestionCard } from "@/features/lesson/components/question-card";
import { requestJson } from "@/lib/client-api";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReviewResponseSchema, type AttemptResult, type RevisionItemView } from "@/types/contracts";

const RATING_LABEL: Record<RecallRating, string> = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };

const SOURCE_LABEL: Record<RevisionItemView["concept"]["source"], string> = {
  checkpoint: "From a checkpoint",
  tutor: "From the tutor",
  chapter: "A chapter",
  key_term: "A key term",
  manual: "Saved by you",
};

const EASE = [0.22, 1, 0.36, 1] as const;
const CARD = "rounded-2xl border bg-card dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]";

export function RevisionScreen({
  due,
  upcoming,
  later,
  nextDueLabel,
  autoStart = false,
}: {
  due: RevisionItemView[];
  upcoming: RevisionItemView[];
  later: RevisionItemView[];
  nextDueLabel: string | null;
  /** Open straight into the review. `?start=1` (the dashboard's Start revision) does the same. */
  autoStart?: boolean;
}) {
  const startParam = useSearchParams().get("start") === "1";
  const [queue, setQueue] = useState(due);
  const [reviewing, setReviewing] = useState((autoStart || startParam) && due.length > 0);
  const [done, setDone] = useState(0);
  const [tab, setTab] = useState(due.length > 0 ? "due" : "upcoming");
  const reduce = useReducedMotion();

  if (reviewing) {
    const item = queue[0];
    const total = done + queue.length;
    // The outgoing card blurs and lifts away while the next one rises into its place.
    const motionProps = reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
      : {
          initial: { opacity: 0, y: 16, filter: "blur(4px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          exit: { opacity: 0, y: -8, scale: 0.98, filter: "blur(4px)" },
        };
    return (
      <div className="grid max-w-2xl gap-5">
        {item ? (
          <div className="flex items-center gap-4">
            <p className="shrink-0 font-mono text-[0.8125rem] text-muted-foreground tabular-nums" aria-live="polite">
              {done + 1} of {total}
            </p>
            <div
              role="progressbar"
              aria-label="Reviewed"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full origin-left rounded-full bg-brand transition-transform duration-300 ease-(--ease-out)"
                style={{ transform: `scaleX(${Math.max(done / total, 0.02)})` }}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-mr-2.5 shrink-0 text-muted-foreground"
              onClick={() => setReviewing(false)}
            >
              Stop for now
            </Button>
          </div>
        ) : null}
        <div className="relative">
          <AnimatePresence mode="popLayout">
            {item ? (
              <motion.div key={item.id} {...motionProps} transition={{ duration: 0.3, ease: EASE }}>
                <ReviewCard
                  item={item}
                  onReviewed={() => {
                    setQueue((q) => q.slice(1));
                    setDone((n) => n + 1);
                  }}
                />
              </motion.div>
            ) : (
              <motion.section
                key="done"
                {...motionProps}
                transition={{ duration: 0.3, ease: EASE }}
                aria-live="polite"
                className={cn(CARD, "grid gap-5 p-6 sm:p-8")}
              >
                <CheckCircleIcon className="size-6 text-positive" />
                <div className="grid gap-1.5">
                  <p className="text-xl font-medium tracking-[-0.01em]">Done for now</p>
                  <p className="text-[0.9375rem] text-muted-foreground">
                    You reviewed <span className="font-mono text-foreground tabular-nums">{done}</span>{" "}
                    {done === 1 ? "concept" : "concepts"}. Each one comes back when it&apos;s due.
                  </p>
                </div>
                <Button asChild variant="outline" className="justify-self-start">
                  <Link href="/app">Back to lessons</Link>
                </Button>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  const all = [...queue, ...upcoming, ...later];
  if (all.length === 0) {
    return (
      <section className="enter grid max-w-2xl gap-1 rounded-2xl border border-dashed p-6 [--i:1]">
        <p className="text-[0.9375rem] font-medium">Nothing saved yet</p>
        <p className="text-sm text-muted-foreground">
          Save a checkpoint, a tutor answer or a chapter while you watch. Each one comes back here for review, starting a day
          later.
        </p>
      </section>
    );
  }

  return (
    <div className="enter grid max-w-3xl gap-10 [--i:1]">
      <section className={cn(CARD, "flex flex-wrap items-end justify-between gap-x-6 gap-y-5 p-5 sm:p-6")}>
        {queue.length === 0 ? (
          <div className="grid gap-1.5">
            <p className="flex items-center gap-2 text-xl font-medium tracking-[-0.01em]">
              <CheckCircleIcon className="size-5 text-positive" />
              All caught up
            </p>
            <p className="text-sm text-muted-foreground">
              {nextDueLabel ? `Next review: ${nextDueLabel.replace(/^Due /, "").toLowerCase()}.` : "Nothing is scheduled."}
            </p>
          </div>
        ) : (
          <p className="flex items-baseline gap-2.5">
            <span className="text-[2.5rem] leading-none font-semibold tracking-[-0.03em] tabular-nums">
              <CountUp value={queue.length} />
            </span>
            <span className="text-sm text-muted-foreground">{queue.length === 1 ? "concept is due now" : "concepts are due now"}</span>
          </p>
        )}
        <Button type="button" size="lg" disabled={queue.length === 0} onClick={() => setReviewing(true)}>
          <EventRepeatIcon />
          {queue.length === 0 ? "Nothing due" : "Start review"}
        </Button>
      </section>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <MorphTabsList
          value={tab}
          className="max-w-md"
          items={[
            { value: "due", label: <TabLabel label="Due now" count={queue.length} /> },
            { value: "upcoming", label: <TabLabel label="Next 7 days" count={upcoming.length} /> },
            { value: "all", label: <TabLabel label="All" count={all.length} /> },
          ]}
        />
        <TabsContent value="due">
          <ItemList items={queue} empty="Nothing is due. Come back when the next one is." />
        </TabsContent>
        <TabsContent value="upcoming">
          <ItemList items={upcoming} empty="Nothing is due in the next 7 days." />
        </TabsContent>
        <TabsContent value="all">
          <ItemList items={all} empty="Nothing saved yet." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TabLabel({ label, count }: { label: string; count: number }) {
  return (
    <>
      {label}
      <span className="font-mono text-[0.75rem] text-faint tabular-nums">{count}</span>
    </>
  );
}

function rewatchHref(item: RevisionItemView): string | null {
  const c = item.concept;
  if (!c.youtubeVideoId) return null;
  const params = new URLSearchParams();
  if (c.sourceSeconds !== null) params.set("t", String(Math.max(0, c.sourceSeconds - 3)));
  if (c.language) params.set("lang", c.language);
  return `/app/lesson/${c.youtubeVideoId}?${params.toString()}`;
}

function ItemList({ items, empty }: { items: RevisionItemView[]; empty: string }) {
  if (items.length === 0) {
    return <p className="rounded-2xl border border-dashed px-5 py-6 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className={cn(CARD, "divide-y overflow-hidden")}>
      {items.map((item) => {
        const href = rewatchHref(item);
        return (
          <li key={item.id} className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 py-3 pr-3 pl-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.concept.title}</p>
              <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                {SOURCE_LABEL[item.concept.source]} · due{" "}
                <span className="font-mono text-[0.75rem] tabular-nums">{formatDue(item.dueAt)}</span>
              </p>
            </div>
            {href ? (
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground [@media(hover:hover)]:hover:text-foreground">
                <Link href={href}>
                  <PlayCircleIcon />
                  Rewatch
                  {item.concept.sourceSeconds !== null ? (
                    <>
                      {" at "}
                      <span className="font-mono tabular-nums">{formatTimestamp(item.concept.sourceSeconds)}</span>
                    </>
                  ) : null}
                </Link>
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function formatDue(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/**
 * One review: answer the linked question first (graded on the server), or recall and then show
 * the answer. Rate with the next interval on each button; a wrong answer pre-selects Again.
 */
function ReviewCard({ item, onReviewed }: { item: RevisionItemView; onReviewed: () => void }) {
  const [attempt, setAttempt] = useState<AttemptResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState<RecallRating | null>(null);
  const [error, setError] = useState<string | null>(null);
  const href = rewatchHref(item);
  const showRatings = item.question ? attempt !== null : revealed;
  const suggested: RecallRating | null = attempt && !attempt.isCorrect ? "again" : null;

  const rate = async (rating: RecallRating) => {
    setSaving(rating);
    setError(null);
    const response = await requestJson(`/api/revision/${item.id}/review`, ReviewResponseSchema, { body: { rating } });
    setSaving(null);
    // Deleted from the Library meanwhile: drop it from the queue (Section 10).
    if (response.ok || response.code === "not_found") onReviewed();
    else setError(response.message);
  };

  return (
    <article aria-labelledby={`review-${item.id}`} className={cn(CARD, "grid gap-6 p-6 sm:p-8")}>
      <header className="grid gap-2.5">
        <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
          <CheckpointMark className="size-2" />
          {SOURCE_LABEL[item.concept.source]}
        </p>
        <h2 id={`review-${item.id}`} className="text-[1.375rem] leading-snug font-medium tracking-[-0.015em] text-balance">
          {item.concept.title}
        </h2>
      </header>

      {item.question ? (
        <QuestionCard question={item.question} durationSeconds={0} onSeek={() => {}} onResult={(result) => setAttempt(result)} />
      ) : revealed ? (
        <div className="grid animate-fade gap-3 border-t pt-5">
          {item.concept.explanationMarkdown ? (
            <Markdown>{item.concept.explanationMarkdown}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">No notes were saved with this one.</p>
          )}
          {item.concept.source !== "manual" ? <AiLabel /> : null}
        </div>
      ) : (
        <div className="grid gap-4">
          <p className="text-[0.9375rem] text-muted-foreground">Say what you remember about it, then check.</p>
          <Button type="button" variant="outline" className="justify-self-start" onClick={() => setRevealed(true)}>
            Show answer
            <ArrowForwardIcon data-icon="inline-end" />
          </Button>
        </div>
      )}

      {showRatings ? (
        <div className="enter grid gap-3 border-t pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p id={`rate-${item.id}`} className="text-sm font-medium">
              How well did you remember it?
            </p>
            {href ? (
              <Link
                href={href}
                className="inline-flex items-center gap-1.5 rounded-md text-[0.8125rem] text-muted-foreground transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:text-foreground"
              >
                <PlayCircleIcon className="size-4" />
                Rewatch
                {item.concept.sourceSeconds !== null ? (
                  <>
                    {" at "}
                    <span className="font-mono tabular-nums">{formatTimestamp(item.concept.sourceSeconds)}</span>
                  </>
                ) : (
                  " in the lecture"
                )}
              </Link>
            ) : null}
          </div>
          <div role="group" aria-labelledby={`rate-${item.id}`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RECALL_RATINGS.map((rating) => (
              <Button
                key={rating}
                type="button"
                variant={suggested === rating ? "default" : "outline"}
                disabled={saving !== null}
                onClick={() => void rate(rating)}
                className="h-auto flex-col gap-1 rounded-[10px] py-3 active:not-aria-[haspopup]:scale-[0.98]"
              >
                <span className="flex items-center gap-1.5">
                  {saving === rating ? <ProgressActivityIcon className="size-4 animate-spin motion-reduce:animate-none" /> : null}
                  {RATING_LABEL[rating]}
                </span>
                <span
                  className={cn(
                    "font-mono text-[0.75rem] font-normal tabular-nums",
                    suggested === rating ? "opacity-70" : "text-muted-foreground",
                  )}
                >
                  {item.intervals[rating]}
                </span>
              </Button>
            ))}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
