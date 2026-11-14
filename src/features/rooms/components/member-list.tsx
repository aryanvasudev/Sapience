"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { EditIcon, PersonRemoveIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isActive, timeAgo } from "@/lib/rooms/progress";
import type { RoomMember } from "@/lib/rooms/service";

import { removeMember, renameMe } from "../actions";
import { MemberAvatar } from "./room-ui";

export function MemberList({ roomId, members, isOwner, now }: { roomId: string; members: RoomMember[]; isOwner: boolean; now: number }) {
  const studying = members.filter((m) => isActive(m.lastActivity?.updatedAt, now)).length;
  return (
    <div className="grid gap-3">
      {studying > 0 ? (
        <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
          <span aria-hidden className="size-2 rounded-full bg-brand" />
          {studying === 1 ? "1 person is studying now" : `${studying} people are studying now`}
        </p>
      ) : null}
      <ul className="grid gap-1" aria-label="Members">
        {members.map((m) => (
          <MemberRow key={m.userId} roomId={roomId} member={m} canRemove={isOwner && !m.isMe} now={now} />
        ))}
      </ul>
    </div>
  );
}

function MemberRow({ roomId, member, canRemove, now }: { roomId: string; member: RoomMember; canRemove: boolean; now: number }) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = isActive(member.lastActivity?.updatedAt, now);
  const last = member.lastActivity;

  return (
    <li className="grid gap-2 rounded-xl px-2 py-2 transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:bg-muted/40">
      <div className="flex items-center gap-3">
        <MemberAvatar name={member.displayName} active={active} />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="truncate text-sm font-medium">
            {member.displayName}
            {member.isMe ? <span className="font-normal text-faint"> (you)</span> : null}
            {member.role === "owner" ? <span className="ml-2 rounded-[5px] border px-1.5 py-px text-[0.6875rem] font-normal text-muted-foreground">Owner</span> : null}
          </p>
          <p className="truncate text-[0.8125rem] text-muted-foreground">
            {last ? (
              <>
                {active ? "Watching " : "Last on "}
                <Link href={`/app/lesson/${last.videoId}`} className="text-foreground/80 underline decoration-foreground/20 underline-offset-4 [@media(hover:hover)]:hover:decoration-foreground/60">
                  {last.videoTitle ?? "a lecture"}
                </Link>
                {active ? null : <span suppressHydrationWarning> · {timeAgo(last.updatedAt, now)}</span>}
              </>
            ) : (
              "Hasn't started a lecture yet"
            )}
          </p>
        </div>
        {member.isMe ? (
          <Button type="button" size="icon-sm" variant="ghost" className="text-faint [@media(hover:hover)]:hover:text-foreground" aria-label="Change your name in this room" onClick={() => setEditing((e) => !e)}>
            <EditIcon />
          </Button>
        ) : canRemove ? (
          confirm ? (
            <span className="flex animate-fade gap-1">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await removeMember({ roomId, userId: member.userId });
                    if (!result.ok) setError(result.message);
                    setConfirm(false);
                  })
                }
              >
                Remove
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button type="button" size="icon-sm" variant="ghost" className="text-faint [@media(hover:hover)]:hover:text-foreground" aria-label={`Remove ${member.displayName} from the room`} onClick={() => setConfirm(true)}>
              <PersonRemoveIcon />
            </Button>
          )
        ) : null}
      </div>
      {editing ? (
        <form
          className="flex animate-fade gap-2 pl-11"
          onSubmit={(event) => {
            event.preventDefault();
            const displayName = String(new FormData(event.currentTarget).get("displayName") ?? "");
            startTransition(async () => {
              const result = await renameMe({ roomId, displayName });
              if (!result.ok) return setError(result.message);
              setError(null);
              setEditing(false);
            });
          }}
        >
          <Input name="displayName" aria-label="Your name in this room" defaultValue={member.displayName} maxLength={40} required className="h-8 md:h-8" autoFocus />
          <Button type="submit" size="sm" disabled={pending}>
            Save
          </Button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="pl-11 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
