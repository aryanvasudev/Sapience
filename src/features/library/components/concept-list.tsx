"use client";

import Link from "next/link";
import { useId, useOptimistic, useState, useTransition } from "react";

import { DeleteIcon, PlayCircleIcon, SearchIcon } from "@/components/icons";
import { Markdown } from "@/components/shared/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTimestamp } from "@/lib/format";
import type { SavedConcept } from "@/lib/library/service";

import { deleteConcept } from "../actions";

const SOURCE_LABEL: Record<SavedConcept["source"], string> = {
  checkpoint: "Checkpoint",
  tutor: "Tutor answer",
  chapter: "Chapter",
  key_term: "Key term",
  manual: "Saved",
};

type Show = "all" | "due" | SavedConcept["source"];

export function ConceptList({ concepts }: { concepts: SavedConcept[] }) {
  const id = useId();
  const [items, removeItem] = useOptimistic(concepts, (state, id: string) => state.filter((c) => c.id !== id));
  const [, startTransition] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");

  const sources = [...new Set(items.map((c) => c.source))];
  const q = query.trim().toLowerCase();
  const visible = items.filter(
    (c) =>
      (show === "all" || (show === "due" ? c.dueLabel === "Due now" : c.source === show)) &&
      (!q || c.title.toLowerCase().includes(q) || (c.videoTitle ?? "").toLowerCase().includes(q)),
  );

  if (items.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed p-6">
        <p className="text-[0.9375rem]">
          Nothing saved yet. In a lesson, use <span className="font-medium">Save for revision</span> on a checkpoint, a tutor
          answer or a chapter.
        </p>
      </div>
    );
  }

  return (
    <>
      {failed ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          Couldn&apos;t remove &ldquo;{failed}&rdquo;. Try again.
        </p>
      ) : null}
      {items.length > 3 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search saved concepts"
              placeholder="Search concepts"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <label htmlFor={`${id}-show`} className="sr-only">
            Show
          </label>
          <select
            id={`${id}-show`}
            value={show}
            onChange={(e) => setShow(e.target.value as Show)}
            className="h-11 rounded-lg border bg-card px-3 text-sm md:h-10"
          >
            <option value="all">All</option>
            <option value="due">Due now</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {visible.length === 0 ? (
        <p className="rounded-[14px] border border-dashed p-6 text-sm text-muted-foreground">Nothing matches. Try other words or show all.</p>
      ) : null}
      <ul className={visible.length ? "divide-y overflow-hidden rounded-[14px] border bg-card" : "hidden"}>
        {visible.map((c) => (
          <li key={c.id} className="grid gap-2 p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  <Markdown inline>{c.title}</Markdown>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {SOURCE_LABEL[c.source]}
                  {c.videoTitle ? ` · ${c.videoTitle}` : ""} · {c.dueLabel}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove “${c.title}” from revision`}
                className="shrink-0 text-muted-foreground"
                onClick={() =>
                  startTransition(async () => {
                    setFailed(null);
                    removeItem(c.id);
                    const r = await deleteConcept({ id: c.id });
                    if (!r.ok) setFailed(c.title);
                  })
                }
              >
                <DeleteIcon />
              </Button>
            </div>
            {c.youtubeVideoId && c.sourceSeconds !== null ? (
              <Button asChild variant="outline" size="sm" className="justify-self-start">
                <Link href={`/app/lesson/${c.youtubeVideoId}?lang=${c.language ?? "en"}&t=${c.sourceSeconds}`}>
                  <PlayCircleIcon />
                  Rewatch from {formatTimestamp(c.sourceSeconds)}
                </Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
