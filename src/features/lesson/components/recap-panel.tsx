"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  CloseIcon,
  DescriptionIcon,
  EventRepeatIcon,
  LibraryAddIcon,
  LightbulbIcon,
  ProgressActivityIcon,
  ReplayIcon,
} from "@/components/icons";
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
    <section aria-labelledby="recap-title" className="grid gap-5 rounded-xl border border-foreground/12 bg-card p-5">
      <header className="flex items-start justify-between gap-3">
        <h2 id="recap-title" className="font-serif text-lg leading-snug font-medium">
          Lesson recap
        </h2>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close the recap">
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
          <dl className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Answered" value={`${recap.checkpoints.answered} of ${recap.checkpoints.total}`} />
            <Stat label="Right first time" value={String(recap.checkpoints.correct)} />
            <Stat label="Saved to revise" value={String(recap.savedConcepts.length)} />
          </dl>

          {recap.worthReviewing.length > 0 ? (
            <section aria-labelledby="recap-review" className="grid gap-2">
              <h3 id="recap-review" className="text-sm font-medium">
                Worth reviewing
              </h3>
              <ul className="grid gap-2">
                {recap.worthReviewing.map((c) => (
                  <li key={c.position} className="grid gap-2 rounded-lg border border-foreground/10 p-3">
                    <p className="flex items-center gap-2 text-sm">
                      <CheckpointDiamond state="wrong" />
                      <span className="min-w-0 flex-1">
                        {c.position + 1}. {c.title}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{formatTimestamp(c.startSeconds)}</span>
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
            <p className="text-sm text-muted-foreground">Every checkpoint you answered, you got right the first time.</p>
          ) : (
            <p className="text-sm text-muted-foreground">You haven&apos;t answered any checkpoints in this lecture yet.</p>
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 pt-4">
              <p className="text-sm text-muted-foreground">
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
    </section>
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
        <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "w-full text-sm text-destructive" : "w-full text-sm text-muted-foreground"}>
          {state.message}
        </p>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 rounded-lg bg-muted/60 px-2 py-3">
      <dt className="order-2 text-xs text-muted-foreground">{label}</dt>
      <dd className="order-1 font-serif text-xl font-medium tabular-nums">{value}</dd>
    </div>
  );
}
