"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useId, useOptimistic, useState, useTransition } from "react";

import { DeleteIcon, PlayCircleIcon, SearchIcon } from "@/components/icons";
import { CheckpointMark } from "@/components/layout/wordmark";
import { Markdown } from "@/components/shared/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { formatTimestamp } from "@/lib/format";
import type { SavedConcept } from "@/lib/library/service";
import { cn } from "@/lib/utils";

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
  const reduce = useReducedMotion();
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
      <div className="grid gap-1 rounded-2xl border border-dashed p-6">
        <p className="text-[0.9375rem] font-medium">Nothing saved yet</p>
        <p className="text-sm text-muted-foreground">
          In a lesson, use <span className="text-foreground">Save for revision</span> on a checkpoint, a tutor answer or a
          chapter.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t remove &ldquo;{failed}&rdquo;. Try again.
        </p>
      ) : null}
      {items.length > 3 ? (
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-faint" />
            <Input
              type="search"
              aria-label="Search saved concepts"
              placeholder="Search concepts"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="rounded-[10px] pl-9 placeholder:text-faint"
            />
          </div>
          <label htmlFor={`${id}-show`} className="sr-only">
            Show
          </label>
          <SelectField<Show>
            id={`${id}-show`}
            value={show}
            onValueChange={setShow}
            options={[
              { value: "all", label: "All" },
              { value: "due", label: "Due now" },
              ...sources.map((s) => ({ value: s, label: SOURCE_LABEL[s] })),
            ]}
            className="h-11 w-auto min-w-36 bg-card md:h-10"
          />
        </div>
      ) : null}
      {visible.length === 0 ? (
        <div className="grid gap-1 rounded-2xl border border-dashed p-6">
          <p className="text-[0.9375rem] font-medium">Nothing matches</p>
          <p className="text-sm text-muted-foreground">Try other words, or show all.</p>
        </div>
      ) : null}
      <ul
        className={
          visible.length
            ? "overflow-hidden rounded-2xl border bg-card dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
            : "hidden"
        }
      >
        <AnimatePresence initial={false}>
          {visible.map((c) => {
            const due = c.dueLabel === "Due now";
            return (
              <motion.li
                key={c.id}
                layout={reduce ? false : "position"}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, filter: "blur(2px)" }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden border-t first:border-t-0"
              >
                <div className="flex items-start gap-3 py-3.5 pr-2.5 pl-4">
                  <CheckpointMark className={cn("mt-[0.4rem] size-2", !due && "bg-faint/50")} />
                  <div className="grid min-w-0 flex-1 gap-2.5">
                    <div>
                      <p className="text-[0.9375rem] leading-snug font-medium">
                        <Markdown inline>{c.title}</Markdown>
                      </p>
                      <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                        {SOURCE_LABEL[c.source]}
                        {c.videoTitle ? ` · ${c.videoTitle}` : ""} ·{" "}
                        <span className={due ? "text-foreground" : undefined}>{c.dueLabel}</span>
                      </p>
                    </div>
                    {c.youtubeVideoId && c.sourceSeconds !== null ? (
                      <Button asChild variant="outline" size="sm" className="justify-self-start">
                        <Link href={`/app/lesson/${c.youtubeVideoId}?lang=${c.language ?? "en"}&t=${c.sourceSeconds}`}>
                          <PlayCircleIcon />
                          Rewatch from <span className="font-mono tabular-nums">{formatTimestamp(c.sourceSeconds)}</span>
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove “${c.title}” from revision`}
                    className="shrink-0 text-faint [@media(hover:hover)]:hover:text-destructive"
                    onClick={() =>
                      startTransition(async () => {
                        setFailed(null);
                        removeItem(c.id);
                        const r = await deleteConcept({ id: c.id });
                        if (!r.ok) setFailed(c.title);
                      })
                    }
                  >
                    <DeleteIcon className="size-4" />
                  </Button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
