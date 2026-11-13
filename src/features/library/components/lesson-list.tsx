"use client";

import { useState } from "react";

import { SearchIcon } from "@/components/icons";
import { LessonRow, type LessonRowData } from "@/components/shared/lesson-row";
import { Input } from "@/components/ui/input";

/** Opened lessons with a title/channel filter once the list is long enough to need one. */
export function LessonList({ lessons }: { lessons: LessonRowData[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = q
    ? lessons.filter((l) => l.title.toLowerCase().includes(q) || (l.channel ?? "").toLowerCase().includes(q))
    : lessons;
  return (
    <div className="grid gap-3">
      {lessons.length > 5 ? (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search lessons"
            placeholder="Search lessons"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      ) : null}
      {visible.length === 0 ? (
        <p className="rounded-[14px] border border-dashed p-6 text-sm text-muted-foreground">No lesson matches. Try other words.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-[14px] border bg-card">
          {visible.map((l) => (
            <li key={l.videoId}>
              <LessonRow item={l} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
