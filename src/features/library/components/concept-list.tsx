"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";

import { DeleteIcon, PlayCircleIcon } from "@/components/icons";
import { Markdown } from "@/components/shared/markdown";
import { Button } from "@/components/ui/button";
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

export function ConceptList({ concepts }: { concepts: SavedConcept[] }) {
  const [items, removeItem] = useOptimistic(concepts, (state, id: string) => state.filter((c) => c.id !== id));
  const [, startTransition] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);

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
      <ul className="divide-y overflow-hidden rounded-[14px] border bg-card">
        {items.map((c) => (
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
