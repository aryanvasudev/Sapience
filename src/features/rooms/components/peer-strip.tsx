"use client";

import Link from "next/link";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useEffect, useState } from "react";

import { GroupsIcon, KeyboardArrowDownIcon } from "@/components/icons";
import { TimestampChip } from "@/components/shared/timestamp-chip";
import { formatTimestamp } from "@/lib/format";
import { chaptersCompleted, isActive, lectureDone, peerSummary, watchedFraction } from "@/lib/rooms/progress";
import type { VideoPeer } from "@/lib/rooms/service";
import { cn } from "@/lib/utils";
import type { ChapterPublic } from "@/types/contracts";

import { getVideoPeers } from "../actions";
import { MemberAvatar } from "./room-ui";

const POLL_MS = 30_000;
const MAX_AVATARS = 4;

/**
 * Classmates from the student's study rooms on this lecture: a one-line strip under the player
 * timeline (who's here, who's ahead), opening a panel with each one's furthest point. Renders
 * nothing when no classmate has opened the lecture.
 */
export function PeerStrip({
  videoId,
  chapters,
  durationSeconds,
  onSeek,
}: {
  videoId: string;
  chapters: ChapterPublic[];
  durationSeconds: number;
  onSeek?: (seconds: number) => void;
}) {
  const [snapshot, setSnapshot] = useState<{ peers: VideoPeer[]; at: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const load = async () => {
      window.clearTimeout(timer);
      if (document.visibilityState === "visible") {
        try {
          const peers = await getVideoPeers({ videoId });
          if (!cancelled) setSnapshot({ peers, at: Date.now() });
        } catch {
          // Offline or signed out: keep the last snapshot.
        }
      }
      if (!cancelled) timer = window.setTimeout(load, POLL_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [videoId]);

  if (!snapshot || snapshot.peers.length === 0) return null;
  const { peers, at: now } = snapshot;
  const ranked = [...peers].sort(
    (a, b) => Number(isActive(b.updatedAt, now)) - Number(isActive(a.updatedAt, now)) || b.furthestSeconds - a.furthestSeconds,
  );
  const anyActive = ranked.some((p) => isActive(p.updatedAt, now));
  const summary = peerSummary(peers, durationSeconds, now, formatTimestamp);

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        className="group/peers flex h-8 w-full min-w-0 animate-fade items-center gap-2.5 rounded-lg px-1.5 text-left text-[0.8125rem] text-muted-foreground transition-colors duration-150 ease-(--ease-out) outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted/60 [@media(hover:hover)]:hover:bg-muted/50 [@media(hover:hover)]:hover:text-foreground"
        aria-label={`Classmates on this lecture: ${summary}`}
      >
        <span className="flex shrink-0 -space-x-1.5">
          {ranked.slice(0, MAX_AVATARS).map((p) => (
            <MemberAvatar key={p.userId} name={p.displayName} size="sm" active={isActive(p.updatedAt, now)} />
          ))}
          {ranked.length > MAX_AVATARS ? (
            <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-full bg-muted font-mono text-[0.625rem] text-muted-foreground ring-1 ring-border">
              +{ranked.length - MAX_AVATARS}
            </span>
          ) : null}
        </span>
        <span className="min-w-0 truncate">{summary}</span>
        {anyActive ? <span className="sr-only">Some classmates are watching now.</span> : null}
        <KeyboardArrowDownIcon className="ml-auto size-4 shrink-0 transition-transform duration-200 ease-(--ease-out) group-data-[state=open]/peers:rotate-180" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 grid max-h-(--radix-popover-content-available-height) w-[min(22rem,calc(100vw-1.5rem))] origin-(--radix-popover-content-transform-origin) gap-3 overflow-y-auto rounded-xl bg-popover p-3 text-popover-foreground shadow-[0_16px_48px_-12px_rgb(0_0_0/0.45)] ring-1 ring-foreground/10 duration-150 ease-(--ease-out) outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <div className="flex items-center gap-2 px-1">
            <GroupsIcon className="size-4 text-muted-foreground" />
            <p className="text-[0.8125rem] font-medium">Classmates on this lecture</p>
          </div>
          <ul className="grid gap-1">
            {ranked.map((p) => (
              <PeerRow key={p.userId} peer={p} chapters={chapters} durationSeconds={durationSeconds} now={now} onSeek={onSeek} />
            ))}
          </ul>
          <p className="px-1 text-xs leading-relaxed text-faint">
            From your{" "}
            <Link href="/app/rooms" className="underline decoration-foreground/20 underline-offset-4 [@media(hover:hover)]:hover:text-foreground">
              study rooms
            </Link>
            . Updates every 30 seconds.
          </p>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function PeerRow({
  peer,
  chapters,
  durationSeconds,
  now,
  onSeek,
}: {
  peer: VideoPeer;
  chapters: ChapterPublic[];
  durationSeconds: number;
  now: number;
  onSeek?: (seconds: number) => void;
}) {
  const active = isActive(peer.updatedAt, now);
  const done = lectureDone(peer.furthestSeconds, durationSeconds);
  const fraction = watchedFraction(peer.furthestSeconds, durationSeconds);
  const completed = chaptersCompleted(peer.furthestSeconds, chapters);

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 rounded-lg px-1 py-1.5">
      <MemberAvatar name={peer.displayName} active={active} />
      <div className="grid min-w-0 gap-0.5">
        <p className="truncate text-[0.8125rem] font-medium">{peer.displayName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {active ? "Watching now · " : ""}
          {done ? "Finished" : chapters.length > 0 ? `Ch ${completed} of ${chapters.length} done` : `${Math.round(fraction * 100)}% watched`}
          {" · "}
          {peer.roomName}
        </p>
      </div>
      {peer.furthestSeconds > 0 ? (
        <TimestampChip seconds={peer.furthestSeconds} onSeek={onSeek} label={`furthest point ${peer.displayName} reached`} />
      ) : (
        <span className="text-xs text-faint">Opened</span>
      )}
      <span aria-hidden className="col-start-2 col-end-4 h-1 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", done ? "bg-brand" : "bg-foreground/35")} style={{ width: `${fraction * 100}%` }} />
      </span>
    </li>
  );
}
