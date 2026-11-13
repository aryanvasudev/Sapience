"use client";

import { useMemo, useState } from "react";

import { ProgressActivityIcon, SearchIcon } from "@/components/icons";
import { MorphText } from "@/components/motion/morph-text";
import { AiLabel } from "@/components/shared/ai-label";
import { TimestampChip } from "@/components/shared/timestamp-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OutputLanguage } from "@/config/enums";
import { requestJson } from "@/lib/client-api";
import { formatTimestamp } from "@/lib/format";
import { instantSearch } from "@/lib/search/lecture-search";
import { seekTarget } from "@/lib/timestamps";
import { SearchResponseSchema, type ChapterPublic, type SearchResponse } from "@/types/contracts";

const KIND_LABEL = { chapter: "Chapter", term: "Key term", moment: "Key moment", segment: "Said in the lecture" } as const;

/**
 * Search the lecture (Section 5.9): an instant filter as you type, and "Ask" for questions in any
 * language. Every result jumps to a time that comes from the lesson, never from the model.
 */
export function SearchPanel({
  videoId,
  language,
  chapters,
  onSeek,
}: {
  videoId: string;
  language: OutputLanguage;
  chapters: ChapterPublic[];
  onSeek: (seconds: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState<{ query: string; response: SearchResponse } | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hits = useMemo(() => instantSearch(chapters, query), [chapters, query]);
  const readyCount = chapters.filter((c) => c.status === "ready").length;
  const jump = (seconds: number) => onSeek(seekTarget(seconds));

  const ask = async () => {
    const q = query.trim();
    if (q.length < 2 || asking) return;
    setAsking(true);
    setError(null);
    const response = await requestJson(`/api/lessons/${videoId}/search`, SearchResponseSchema, { body: { query: q, language } });
    setAsking(false);
    if (response.ok) setAsked({ query: q, response: response.data });
    else setError(response.message);
  };

  if (readyCount === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
        Search works once the first chapter&apos;s notes are ready.
      </p>
    );
  }

  return (
    <section aria-label="Search the lecture" className="grid gap-5">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
        className="grid gap-2"
      >
        <label htmlFor="lecture-search" className="text-sm font-medium">
          Search this lecture
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-faint" />
            <Input
              id="lecture-search"
              type="search"
              value={query}
              maxLength={200}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="A word, or a question in any language"
              className="pl-9.5"
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="outline" disabled={query.trim().length < 2 || asking}>
            {asking ? <ProgressActivityIcon className="animate-spin motion-reduce:animate-none" /> : null}
            <MorphText>{asking ? "Asking…" : "Ask"}</MorphText>
          </Button>
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-faint">
          Matches show as you type. Ask finds where a question is answered, even across languages.
        </p>
      </form>

      {error ? (
        <p role="alert" className="animate-fade text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {asked && asked.query === query.trim() ? (
        <section aria-label="Answers from Ask" className="grid animate-fade gap-3">
          {asked.response.partial ? (
            <p className="text-[0.8125rem] text-faint">
              Searched {asked.response.partial.searched} of {asked.response.partial.total} chapters (the rest are still building).
            </p>
          ) : null}
          {asked.response.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing in this lecture matches. Try different words, or ask the tutor.</p>
          ) : (
            <ol className="grid gap-2">
              {asked.response.results.map((r) => (
                <li key={r.ref} className="grid gap-1.5 rounded-[10px] border bg-card p-3 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium">{r.label}</p>
                    <TimestampChip seconds={r.seconds} onSeek={jump} label={r.label} />
                  </div>
                  {r.why ? <p className="text-sm leading-relaxed text-foreground/85">{r.why}</p> : null}
                  {r.snippet ? <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">“{r.snippet}”</p> : null}
                </li>
              ))}
            </ol>
          )}
          <AiLabel note="places are picked by AI; times come from the lesson" className="text-faint" />
        </section>
      ) : null}

      {query.trim().length >= 2 ? (
        <section aria-label="Matches" className="grid gap-2">
          <h3 className="text-[0.8125rem] text-muted-foreground" aria-live="polite">
            {hits.length === 0 ? "Nothing in this lecture matches. Try different words, or Ask to search by meaning." : `${hits.length === 20 ? "20+" : hits.length} ${hits.length === 1 ? "match" : "matches"}`}
          </h3>
          <ul className="-mx-2.5 grid gap-0.5">
            {hits.map((h) => (
              <li key={`${h.kind}-${h.ref}`}>
                <button
                  type="button"
                  onClick={() => jump(h.seconds)}
                  className="grid w-full gap-0.5 rounded-[10px] px-2.5 py-2 text-left transition-colors duration-150 ease-(--ease-out) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [@media(hover:hover)]:hover:bg-muted/60"
                >
                  <span className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{h.label}</span>
                    <span className="shrink-0 font-mono text-[0.75rem] text-faint tabular-nums">{formatTimestamp(h.seconds)}</span>
                  </span>
                  <span className="line-clamp-2 text-[0.75rem] leading-snug text-faint">
                    {KIND_LABEL[h.kind]}
                    {h.snippet ? ` · ${h.snippet}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

