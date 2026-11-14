"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DeleteIcon, ExitToAppIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { deleteRoom, leaveRoom } from "../actions";

/** Leave (members) or delete (owner) the room, each with a one-step confirmation. */
export function RoomExit({ roomId, roomName, isOwner }: { roomId: string; roomName: string; isOwner: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      setError(null);
      const result = isOwner ? await deleteRoom({ roomId }) : await leaveRoom({ roomId });
      if (!result.ok) return setError(result.message);
      router.replace("/app/rooms");
      router.refresh();
    });

  return (
    <div className="grid gap-2">
      {confirm ? (
        <div className="grid animate-fade gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-[0.8125rem] leading-relaxed">
            {isOwner
              ? `Delete “${roomName}” for everyone? Its goals and ticks go too. Everyone's own lessons and progress stay.`
              : `Leave “${roomName}”? You can rejoin with its code.`}
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={run}>
              {isOwner ? "Delete room" : "Leave room"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="ghost" className="justify-self-start text-muted-foreground" onClick={() => setConfirm(true)}>
          {isOwner ? <DeleteIcon /> : <ExitToAppIcon />}
          {isOwner ? "Delete room" : "Leave room"}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
