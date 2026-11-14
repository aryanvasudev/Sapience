"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import { BookmarkIcon, DeleteIcon, EditIcon } from "@/components/icons";
import { TimestampChip } from "@/components/shared/timestamp-chip";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/format";
import type { PersonalNote } from "@/lib/notes/service";

import { addNote, deleteNote, updateNote } from "./actions";

export const bySeconds = (a: PersonalNote, b: PersonalNote) => (a.seconds ?? -1) - (b.seconds ?? -1) || a.createdAt.localeCompare(b.createdAt);

/**
 * The student's own notes and saved moments (bookmarks) for this lecture (Section 3.2, P1).
 * Written by the student, so no AI label; each one is pinned to the playback time it was written
 * at. The list is owned by the lesson screen, since moments are also saved from under the player.
 */
export function MyNotesPanel({
  videoId,
  notes,
  setNotes,
  time,
  onSeek,
  focusSignal = 0,
}: {
  videoId: string;
  notes: PersonalNote[];
  setNotes: (update: (notes: PersonalNote[]) => PersonalNote[]) => void;
  /** Current playback time, in seconds. */
  time: number;
  onSeek: (seconds: number) => void;
  /** Bump to focus the note box ("Taking notes" after a pause). */
  focusSignal?: number;
}) {
  const id = useId();
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    if (focusSignal > 0) draftRef.current?.focus({ preventScroll: false });
  }, [focusSignal]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const at = Math.max(0, Math.floor(time));

  const save = (kind: "note" | "bookmark") =>
    startTransition(async () => {
      setError(null);
      const r = await addNote({ videoId, kind, seconds: at, content: kind === "note" ? draft : undefined });
      if (!r.ok) return setError(r.message);
      setNotes((ns) => [...ns, r.note].sort(bySeconds));
      if (kind === "note") setDraft("");
    });

  return (
    <div className="grid gap-5">
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save("note");
        }}
      >
        <label htmlFor={`${id}-draft`} className="text-sm font-medium">
          Note at <span className="font-mono text-[0.8125rem] text-muted-foreground tabular-nums">{formatTimestamp(at)}</span>
        </label>
        <textarea
          ref={draftRef}
          id={`${id}-draft`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save("note");
            }
          }}
          rows={3}
          maxLength={4000}
          placeholder="What do you want to remember from here?"
          className="min-h-20 w-full resize-y rounded-[10px] border bg-card px-3 py-2 text-sm leading-relaxed transition-[border-color,box-shadow] duration-150 ease-(--ease-out) outline-none placeholder:text-faint focus-visible:border-brand/50 focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_14%,transparent)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending || draft.trim().length === 0}>
            Save note
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => save("bookmark")}>
            <BookmarkIcon />
            Save moment <span className="font-mono text-[0.75rem] tabular-nums">{formatTimestamp(at)}</span>
          </Button>
        </div>
        {error ? (
          <p role="alert" className="animate-fade text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>

      {notes.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-5 text-sm leading-relaxed text-muted-foreground">
          Your own notes and saved moments for this lecture show up here, in lecture order. Save a moment from under the
          video (or press B). They&apos;re private to you and appear on the exam sheet.
        </p>
      ) : (
        <ol className="grid gap-2" aria-label="Your notes">
          {notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              onSeek={onSeek}
              onChange={(next) => setNotes((ns) => ns.map((n) => (n.id === next.id ? next : n)))}
              onDelete={() => setNotes((ns) => ns.filter((n) => n.id !== note.id))}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function NoteItem({
  note,
  onSeek,
  onChange,
  onDelete,
}: {
  note: PersonalNote;
  onSeek: (seconds: number) => void;
  onChange: (note: PersonalNote) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = note.kind === "bookmark" ? "Saved moment" : "Note";

  return (
    <li className="grid gap-2 rounded-[10px] border bg-card p-3 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
      <div className="-my-0.5 -mr-1 flex items-center gap-2">
        {note.seconds !== null ? <TimestampChip seconds={note.seconds} onSeek={onSeek} label={label} /> : null}
        {note.kind === "bookmark" ? <BookmarkIcon className="size-4 text-faint" aria-label="Saved moment" /> : null}
        <div className="ml-auto flex gap-0.5">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-faint [@media(hover:hover)]:hover:text-foreground"
            aria-label={`Edit ${label.toLowerCase()} at ${formatTimestamp(note.seconds ?? 0)}`}
            onClick={() => setEditing((e) => !e)}
          >
            <EditIcon />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-faint [@media(hover:hover)]:hover:text-foreground"
            disabled={pending}
            aria-label={`Delete ${label.toLowerCase()} at ${formatTimestamp(note.seconds ?? 0)}`}
            onClick={() =>
              startTransition(async () => {
                const r = await deleteNote({ id: note.id });
                if (r.ok) onDelete();
                else setError("Couldn't delete that. Try again.");
              })
            }
          >
            <DeleteIcon />
          </Button>
        </div>
      </div>
      {editing ? (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const r = await updateNote({ id: note.id, content: value });
              if (!r.ok) return setError(r.message);
              onChange(r.note);
              setEditing(false);
              setError(null);
            });
          }}
        >
          <textarea
            aria-label={`${label} text`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            maxLength={4000}
            className="w-full resize-y rounded-[10px] border bg-background px-3 py-2 text-sm leading-relaxed transition-[border-color,box-shadow] duration-150 ease-(--ease-out) outline-none placeholder:text-faint focus-visible:border-brand/50 focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_14%,transparent)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : note.content ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{note.content}</p>
      ) : null}
      {error ? (
        <p role="alert" className="animate-fade text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
