"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { GroupAddIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { createRoom } from "../actions";
import { Field, FormError } from "./room-ui";

export function CreateRoomDialog({ defaultName }: { defaultName: string }) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <GroupAddIcon />
          Create a room
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a study room</DialogTitle>
          <DialogDescription>A private room for your class or study group. People join with its code or QR.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setError(null);
            startTransition(async () => {
              const result = await createRoom({
                name: String(form.get("name") ?? ""),
                description: String(form.get("description") ?? ""),
                displayName: String(form.get("displayName") ?? ""),
              });
              if (!result.ok) return setError(result.message);
              setOpen(false);
              router.push(`/app/rooms/${result.roomId}`);
            });
          }}
        >
          <Field id={`${id}-name`} label="Room name">
            <Input id={`${id}-name`} name="name" required maxLength={60} placeholder="Physics 2nd year, Batch B" autoComplete="off" />
          </Field>
          <Field id={`${id}-description`} label="What it's for (optional)">
            <Textarea id={`${id}-description`} name="description" maxLength={280} rows={2} placeholder="Finishing mechanics before the mid-terms" />
          </Field>
          <Field id={`${id}-display`} label="Your name in this room" hint="Classmates see this next to your progress.">
            <Input id={`${id}-display`} name="displayName" required maxLength={40} defaultValue={defaultName} autoComplete="nickname" />
          </Field>
          <FormError message={error} />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create room"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
