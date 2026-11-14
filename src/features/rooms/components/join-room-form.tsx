"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRoomCode } from "@/lib/rooms/code";

import { joinRoom } from "../actions";
import { Field, FormError } from "./room-ui";

/** Confirm the name you'll show, then join the room behind `code`. */
export function JoinRoomForm({ code, defaultName }: { code: string; defaultName: string }) {
  const id = useId();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const displayName = String(new FormData(event.currentTarget).get("displayName") ?? "");
        setError(null);
        startTransition(async () => {
          const result = await joinRoom({ code, displayName });
          if (!result.ok) return setError(result.message);
          router.replace(`/app/rooms/${result.roomId}`);
        });
      }}
    >
      <div className="grid gap-1">
        <span className="text-[0.8125rem] text-muted-foreground">Room code</span>
        <span className="font-mono text-2xl font-medium tracking-[0.14em] tabular-nums">{formatRoomCode(code)}</span>
      </div>
      <Field id={`${id}-name`} label="Your name in this room" hint="Classmates in the room see your name, which lectures you're on and how far you've got.">
        <Input id={`${id}-name`} name="displayName" required maxLength={40} defaultValue={defaultName} autoComplete="nickname" />
      </Field>
      <FormError message={error} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Joining…" : "Join room"}
        </Button>
      </div>
    </form>
  );
}
