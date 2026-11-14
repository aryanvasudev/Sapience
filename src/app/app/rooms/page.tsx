import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ChevronRightIcon, EventIcon, GroupsIcon } from "@/components/icons";
import { PageHeader, SectionHeading } from "@/components/layout/page-header";
import { CreateRoomDialog } from "@/features/rooms/components/create-room-dialog";
import { JoinByCode } from "@/features/rooms/components/join-by-code";
import { requireUser } from "@/lib/auth";
import { defaultDisplayName, listMyRooms, type RoomSummary } from "@/lib/rooms/service";

export const metadata: Metadata = { title: "Study rooms" };

export default function RoomsPage() {
  return (
    <div className="grid gap-10 md:gap-12">
      <Suspense fallback={<RoomsSkeleton />}>
        <RoomsLoader />
      </Suspense>
    </div>
  );
}

async function RoomsLoader() {
  const user = await requireUser("/app/rooms");
  const [rooms, displayName] = await Promise.all([listMyRooms(user), defaultDisplayName(user)]);

  return (
    <>
      <PageHeader
        title="Study rooms"
        description="Private rooms for your class or study group: shared goals, deadlines, and who's watched what."
        actions={<CreateRoomDialog defaultName={displayName} />}
      />

      <section aria-label="Join a room" className="enter rounded-2xl border bg-card p-5 [--i:1] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
        <JoinByCode />
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
          Got a QR code? Scan it here, or with your phone&apos;s camera app.
        </p>
      </section>

      <section aria-labelledby="rooms-heading" className="enter grid gap-4 [--i:2]">
        <SectionHeading
          id="rooms-heading"
          meta={rooms?.length ? <span className="font-mono text-[0.8125rem] text-faint tabular-nums">{rooms.length}</span> : undefined}
        >
          Your rooms
        </SectionHeading>
        {rooms === null ? (
          <p role="alert" className="text-sm text-destructive">
            Couldn&apos;t load your rooms. Refresh the page to try again.
          </p>
        ) : rooms.length === 0 ? (
          <div className="grid gap-1 rounded-2xl border border-dashed p-6">
            <p className="text-[0.9375rem] font-medium">You&apos;re not in any rooms yet</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Create one and share its code, or join a classmate&apos;s. Inside, you set goals together and see how far everyone has got.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function RoomCard({ room }: { room: RoomSummary }) {
  const progress = room.goalCount > 0 ? room.goalsDoneByMe / room.goalCount : 0;
  return (
    <li>
      <Link
        href={`/app/rooms/${room.id}`}
        className="group/room grid h-full gap-4 rounded-2xl border bg-card p-5 transition-[border-color,background-color,transform] duration-150 ease-(--ease-out) outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)] [@media(hover:hover)]:hover:border-foreground/20"
      >
        <div className="flex items-start gap-3">
          <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-raised text-muted-foreground ring-1 ring-border">
            <GroupsIcon className="size-4.5" />
          </span>
          <div className="grid min-w-0 flex-1 gap-1">
            <p className="truncate text-[0.9375rem] font-medium">{room.name}</p>
            <p className="text-[0.8125rem] text-muted-foreground">
              {room.memberCount === 1 ? "Just you" : `${room.memberCount} people`}
              {room.isOwner ? " · You own it" : ""}
            </p>
          </div>
          <ChevronRightIcon className="size-4.5 shrink-0 text-faint transition-transform duration-150 ease-(--ease-out) [@media(hover:hover)]:group-hover/room:translate-x-0.5" />
        </div>
        {room.description ? <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{room.description}</p> : null}
        <div className="mt-auto grid gap-2">
          {room.goalCount > 0 ? (
            <div className="grid gap-1.5">
              <div className="flex items-baseline justify-between text-[0.8125rem]">
                <span className="text-muted-foreground">Your goals</span>
                <span className="font-mono text-[0.75rem] text-faint tabular-nums">
                  {room.goalsDoneByMe}/{room.goalCount}
                </span>
              </div>
              <span aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${progress * 100}%` }} />
              </span>
            </div>
          ) : (
            <p className="text-[0.8125rem] text-faint">No goals yet</p>
          )}
          {room.nextDue ? (
            <p className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
              <EventIcon className="size-4 shrink-0" />
              <span className="truncate">
                {room.nextDue.title} ·{" "}
                <span suppressHydrationWarning>
                  {new Date(room.nextDue.dueAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </span>
              </span>
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function RoomsSkeleton() {
  return (
    <div aria-hidden className="grid gap-10">
      <div className="grid gap-3">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
      </div>
      <div className="h-28 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
