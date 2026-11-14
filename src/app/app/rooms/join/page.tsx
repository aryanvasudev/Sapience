import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ArrowBackIcon, GroupsIcon } from "@/components/icons";
import { JoinByCode } from "@/features/rooms/components/join-by-code";
import { JoinRoomForm } from "@/features/rooms/components/join-room-form";
import { requireUser } from "@/lib/auth";
import { isRoomCode, joinPath, normalizeRoomCode } from "@/lib/rooms/code";
import { defaultDisplayName } from "@/lib/rooms/service";

export const metadata: Metadata = { title: "Join a study room" };

/** Where invite links and QR codes land: confirm your name, then join. */
export default function JoinRoomPage({ searchParams }: PageProps<"/app/rooms/join">) {
  return (
    <div className="mx-auto grid w-full max-w-md gap-6 pt-4 md:pt-10">
      <Suspense fallback={<div aria-hidden className="h-72 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />}>
        <JoinLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function JoinLoader({ searchParams }: { searchParams: PageProps<"/app/rooms/join">["searchParams"] }) {
  const query = await searchParams;
  const raw = typeof query.code === "string" ? query.code : "";
  const code = normalizeRoomCode(raw);
  const valid = isRoomCode(code);
  const user = await requireUser(valid ? joinPath(code) : "/app/rooms/join");
  const displayName = await defaultDisplayName(user);

  return (
    <section className="enter grid gap-6 rounded-2xl border bg-card p-6 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
      <div className="flex items-start gap-3">
        <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-raised text-muted-foreground ring-1 ring-border">
          <GroupsIcon className="size-5" />
        </span>
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold tracking-[-0.02em]">Join a study room</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {valid ? "You've been invited to a room. Check the name you'll show, then join." : raw ? "That invite code isn't valid. Check it, or scan the QR again." : "Type the room's code or scan its QR."}
          </p>
        </div>
      </div>
      {valid ? <JoinRoomForm code={code} defaultName={displayName} /> : <JoinByCode />}
      <Link
        href="/app/rooms"
        className="inline-flex items-center gap-1.5 justify-self-start text-[0.8125rem] text-muted-foreground transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:text-foreground"
      >
        <ArrowBackIcon className="size-4" />
        Your rooms
      </Link>
    </section>
  );
}
