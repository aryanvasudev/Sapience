"use client";

import Link from "next/link";
import { useState } from "react";

import { CheckCircleIcon, EventRepeatIcon, PlayCircleIcon, ProgressActivityIcon } from "@/components/icons";
import { AiLabel } from "@/components/shared/ai-label";
import { Markdown } from "@/components/shared/markdown";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  /** Open straight into the review (from the dashboard's Start revision). */
  autoStart?: boolean;
}) {
  const [queue, setQueue] = useState(due);
  const [reviewing, setReviewing] = useState(autoStart && due.length > 0);
  const [done, setDone] = useState(0);

  if (reviewing) {
    const item = queue[0];
    if (!item) {
      return (
        <section aria-live="polite" className="grid max-w-xl gap-4 rounded-xl border border-foreground/10 bg-card p-6">
          <p className="flex items-center gap-2 font-serif text-xl font-medium">
            <CheckCircleIcon className="size-5" />
            Done for now
          </p>
          <p className="text-sm text-muted-foreground">
            You reviewed {done} {done === 1 ? "concept" : "concepts"}. Each one comes back when it&apos;s due.
          </p>
          <Button asChild variant="outline" className="justify-self-start">
            <Link href="/app">Back to lessons</Link>
          </Button>
        </section>
      );
    }
    return (
      <div className="grid max-w-2xl gap-4">
        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {done + 1} of {done + queue.length}
        </p>
        <ReviewCard
          key={item.id}
          item={item}
          onReviewed={() => {
            setQueue((q) => q.slice(1));
            setDone((n) => n + 1);
          }}
        />
        <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setReviewing(false)}>
          Stop for now
        </Button>
      </div>
    );
  }

  const all = [...queue, ...upcoming, ...later];
  if (all.length === 0) {
    return (
      <section className="grid max-w-xl gap-3 rounded-xl border border-dashed border-foreground/15 p-6">
        <p className="font-serif text-lg font-medium">Nothing saved yet</p>
        <p className="text-sm text-muted-foreground">
          Save a checkpoint, a tutor answer or a chapter while you watch. Each one comes back here for review, starting a day later.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-8">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-foreground/10 bg-card p-5">
        {queue.length === 0 ? (
          <div>
            <p className="flex items-center gap-2 font-serif text-xl font-medium">
              <CheckCircleIcon className="size-5" />
              All caught up
            </p>
            <p className="text-sm text-muted-foreground">
              {nextDueLabel ? `Next review: ${nextDueLabel.replace(/^Due /, "").toLowerCase()}.` : "Nothing is scheduled."}
            </p>
          </div>
        ) : (
          <div>
            <p className="font-serif text-3xl font-medium tabular-nums">{queue.length}</p>
            <p className="text-sm text-muted-foreground">{queue.length === 1 ? "concept is due now" : "concepts are due now"}</p>
          </div>
        )}
        <Button type="button" size="lg" disabled={queue.length === 0} onClick={() => setReviewing(true)}>
          <EventRepeatIcon />
          {queue.length === 0 ? "Nothing due" : "Start review"}
        </Button>
      </section>

      <Tabs defaultValue={queue.length > 0 ? "due" : "upcoming"} className="gap-4">
        <TabsList>
          <TabsTrigger value="due">Due now · {queue.length}</TabsTrigger>
          <TabsTrigger value="upcoming">Next 7 days · {upcoming.length}</TabsTrigger>
          <TabsTrigger value="all">All · {all.length}</TabsTrigger>
        </TabsList>
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

function rewatchHref(item: RevisionItemView): string | null {
  const c = item.concept;
  if (!c.youtubeVideoId) return null;
  const params = new URLSearchParams();
  if (c.sourceSeconds !== null) params.set("t", String(Math.max(0, c.sourceSeconds - 3)));
  if (c.language) params.set("lang", c.language);
  return `/app/lesson/${c.youtubeVideoId}?${params.toString()}`;
}

function ItemList({ items, empty }: { items: RevisionItemView[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-foreground/8 rounded-xl border border-foreground/10 bg-card">
      {items.map((item) => {
        const href = rewatchHref(item);
        return (
          <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.concept.title}</p>
              <p className="text-xs text-muted-foreground">
                {SOURCE_LABEL[item.concept.source]} · due {formatDue(item.dueAt)}
              </p>
            </div>
            {href ? (
              <Link href={href} className="text-sm text-primary underline-offset-4 [@media(hover:hover)]:hover:underline">
                Rewatch{item.concept.sourceSeconds !== null ? ` at ${formatTimestamp(item.concept.sourceSeconds)}` : ""}
              </Link>
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
    <article aria-labelledby={`review-${item.id}`} className="grid gap-5 rounded-xl border border-foreground/12 bg-card p-5 sm:p-6">
      <header className="grid gap-1">
        <p className="text-xs text-muted-foreground">{SOURCE_LABEL[item.concept.source]}</p>
        <h2 id={`review-${item.id}`} className="font-serif text-xl leading-snug font-medium">
          {item.concept.title}
        </h2>
      </header>

      {item.question ? (
        <QuestionCard question={item.question} durationSeconds={0} onSeek={() => {}} onResult={(result) => setAttempt(result)} />
      ) : revealed ? (
        <div className="grid gap-3">
          {item.concept.explanationMarkdown ? (
            <Markdown className="text-sm">{item.concept.explanationMarkdown}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">No notes were saved with this one.</p>
          )}
          {item.concept.source !== "manual" ? <AiLabel /> : null}
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Say what you remember about it, then check.</p>
          <Button type="button" variant="outline" className="justify-self-start" onClick={() => setRevealed(true)}>
            Show answer
          </Button>
        </div>
      )}

      {href && showRatings ? (
        <Link href={href} className="inline-flex items-center gap-1.5 justify-self-start text-sm text-primary underline-offset-4 [@media(hover:hover)]:hover:underline">
          <PlayCircleIcon className="size-4.5" />
          Rewatch{item.concept.sourceSeconds !== null ? ` at ${formatTimestamp(item.concept.sourceSeconds)}` : " in the lecture"}
        </Link>
      ) : null}

      {showRatings ? (
        <div className="grid gap-2 border-t border-foreground/10 pt-4">
          <p id={`rate-${item.id}`} className="text-sm font-medium">
            How well did you remember it?
          </p>
          <div role="group" aria-labelledby={`rate-${item.id}`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RECALL_RATINGS.map((rating) => (
              <Button
                key={rating}
                type="button"
                variant={suggested === rating ? "default" : "outline"}
                disabled={saving !== null}
                onClick={() => void rate(rating)}
                className={cn("h-auto flex-col gap-0.5 py-2.5")}
              >
                <span className="flex items-center gap-1.5">
                  {saving === rating ? <ProgressActivityIcon className="animate-spin motion-reduce:animate-none" /> : null}
                  {RATING_LABEL[rating]}
                </span>
                <span className={cn("text-xs tabular-nums", suggested === rating ? "opacity-80" : "text-muted-foreground")}>
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
