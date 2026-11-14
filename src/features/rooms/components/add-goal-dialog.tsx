"use client";

import { useId, useState, useTransition } from "react";

import { AddIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { addGoal } from "../actions";
import { Field, FormError, SELECT_CLASS } from "./room-ui";

export type LecturePick = { videoId: string; title: string };

const PASTE = "__paste__";

/** Add a goal: a lecture everyone should finish, or anything else, with an optional due date. */
export function AddGoalDialog({ roomId, lectures }: { roomId: string; lectures: LecturePick[] }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [lecture, setLecture] = useState<string>(lectures.length > 0 ? "" : PASTE);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <AddIcon />
          Add goal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a goal</DialogTitle>
          <DialogDescription>Everyone in the room sees it and can tick it off. Lecture goals tick themselves once 90% is watched.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const date = String(form.get("dueDate") ?? "");
            const time = String(form.get("dueTime") ?? "") || "23:59";
            const video = lecture === PASTE ? String(form.get("videoUrl") ?? "").trim() : lecture;
            setError(null);
            startTransition(async () => {
              const result = await addGoal({
                roomId,
                title: String(form.get("title") ?? "").trim() || undefined,
                video: video || undefined,
                dueAt: date ? new Date(`${date}T${time}`).toISOString() : undefined,
              });
              if (!result.ok) return setError(result.message);
              setOpen(false);
              setLecture(lectures.length > 0 ? "" : PASTE);
            });
          }}
        >
          <Field id={`${id}-lecture`} label="Lecture (optional)">
            <select id={`${id}-lecture`} value={lecture} onChange={(e) => setLecture(e.target.value)} className={SELECT_CLASS}>
              <option value="">No lecture, just a goal</option>
              {lectures.map((l) => (
                <option key={l.videoId} value={l.videoId}>
                  {l.title}
                </option>
              ))}
              <option value={PASTE}>Paste a YouTube link…</option>
            </select>
          </Field>
          {lecture === PASTE ? (
            <Field id={`${id}-url`} label="YouTube link">
              <Input id={`${id}-url`} name="videoUrl" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" className="animate-fade" />
            </Field>
          ) : null}
          <Field id={`${id}-title`} label={lecture ? "Goal (optional)" : "Goal"} hint={lecture ? "Leave empty to use “Watch” and the lecture's title." : undefined}>
            <Input id={`${id}-title`} name="title" maxLength={120} required={!lecture} placeholder={lecture ? "Watch it and solve the 3 board problems" : "Finish problem set 4"} autoComplete="off" />
          </Field>
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <Field id={`${id}-date`} label="Due (optional)">
              <Input id={`${id}-date`} name="dueDate" type="date" />
            </Field>
            <Field id={`${id}-time`} label="Time">
              <Input id={`${id}-time`} name="dueTime" type="time" defaultValue="23:59" />
            </Field>
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add goal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
