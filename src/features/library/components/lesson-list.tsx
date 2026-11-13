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
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-faint" />
          <Input
            type="search"
            aria-label="Search lessons"
            placeholder="Search lessons"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-[10px] pl-9 placeholder:text-faint"
          />
        </div>
      ) : null}
      {visible.length === 0 ? (
        <div className="grid gap-1 rounded-2xl border border-dashed p-6">
          <p className="text-[0.9375rem] font-medium">No lesson matches</p>
          <p className="text-sm text-muted-foreground">Try other words from the title or channel.</p>
        </div>
      ) : (
        <ul className="-mx-2.5 grid gap-0.5">
          {visible.map((l) => (
            <li key={`${l.videoId}-${l.language}`}>
              <LessonRow item={l} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
