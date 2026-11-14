import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { ArrowBackIcon } from "@/components/icons";
import { PageHeader, SectionHeading } from "@/components/layout/page-header";
import { clientEnv } from "@/env";
import { ActivityFeed } from "@/features/rooms/components/activity-feed";
import { AddGoalDialog } from "@/features/rooms/components/add-goal-dialog";
import { GoalList } from "@/features/rooms/components/goal-list";
import { InviteCard } from "@/features/rooms/components/invite-card";
import { MemberList } from "@/features/rooms/components/member-list";
import { RoomExit } from "@/features/rooms/components/room-exit";
import { requireUser } from "@/lib/auth";
import { listOpenedLessons } from "@/lib/library/service";
import { buildActivity } from "@/lib/rooms/progress";
import { getRoom } from "@/lib/rooms/service";

export const metadata: Metadata = { title: "Study room" };

export default function RoomPage({ params }: PageProps<"/app/rooms/[roomId]">) {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <RoomLoader params={params} />
    </Suspense>
  );
}

const count = (n: number) => <span className="font-mono text-[0.8125rem] text-faint tabular-nums">{n}</span>;

async function RoomLoader({ params }: { params: PageProps<"/app/rooms/[roomId]">["params"] }) {
  const { roomId: raw } = await params;
  const roomId = z.uuid().safeParse(raw);
  if (!roomId.success) notFound();
  const user = await requireUser(`/app/rooms/${roomId.data}`);
  const [room, lessons] = await Promise.all([getRoom(user, roomId.data), listOpenedLessons()]);
  if (!room) notFound();

  const { now } = room;
  const activity = buildActivity({ members: room.members, goals: room.goals });
  const lectures = (lessons ?? []).slice(0, 50).map((l) => ({ videoId: l.videoId, title: l.title }));

  return (
    <div className="grid gap-8 md:gap-10">
      <div className="grid gap-4">
        <Link
          href="/app/rooms"
          className="inline-flex items-center gap-1.5 justify-self-start text-[0.8125rem] text-muted-foreground transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:text-foreground"
        >
          <ArrowBackIcon className="size-4" />
          Study rooms
        </Link>
        <PageHeader
          title={room.name}
          description={room.description ?? `${room.members.length === 1 ? "Just you so far" : `${room.members.length} people`}. Invite classmates with the code.`}
        />
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="goals-heading" className="enter grid min-w-0 gap-4 [--i:1]">
          <div className="flex items-center justify-between gap-4">
            <h2 id="goals-heading" className="flex items-baseline gap-2 text-[0.9375rem] font-medium">
              Goals {room.goals.length > 0 ? count(room.goals.length) : null}
            </h2>
            <AddGoalDialog roomId={room.id} lectures={lectures} />
          </div>
          <GoalList goals={room.goals} members={room.members} me={room.me} now={now} />
        </section>

        <aside className="enter grid min-w-0 gap-8 [--i:2]">
          <InviteCard roomId={room.id} roomName={room.name} code={room.code} isOwner={room.isOwner} appUrl={clientEnv().NEXT_PUBLIC_APP_URL} />
          <section aria-labelledby="members-heading" className="grid gap-3">
            <SectionHeading id="members-heading" meta={count(room.members.length)}>
              Members
            </SectionHeading>
            <MemberList roomId={room.id} members={room.members} isOwner={room.isOwner} now={now} />
          </section>
          <section aria-labelledby="activity-heading" className="grid gap-3">
            <SectionHeading id="activity-heading">Activity</SectionHeading>
            <ActivityFeed items={activity} now={now} />
          </section>
          <RoomExit roomId={room.id} roomName={room.name} isOwner={room.isOwner} />
        </aside>
      </div>
    </div>
  );
}

function RoomSkeleton() {
  return (
    <div aria-hidden className="grid gap-8">
      <div className="grid gap-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
          ))}
        </div>
        <div className="grid content-start gap-3">
          <div className="h-36 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
