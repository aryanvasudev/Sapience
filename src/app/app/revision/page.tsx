import type { Metadata } from "next";
import { Suspense } from "react";

import { RevisionScreen } from "@/features/revision/components/revision-screen";
import { requireUser } from "@/lib/auth";
import { listRevisionGrouped } from "@/lib/revision/service";

export const metadata: Metadata = { title: "Revision" };

export default function RevisionPage({ searchParams }: PageProps<"/app/revision">) {
  return (
    <div className="grid gap-8">
      <header className="grid max-w-2xl gap-2">
        <h1 className="font-serif text-3xl font-medium tracking-[-0.01em]">Revision</h1>
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
          What you saved comes back just before you&apos;d forget it. Rate each one honestly and the gaps adjust.
        </p>
      </header>
      <Suspense fallback={<RevisionSkeleton />}>
        <RevisionLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function RevisionLoader({ searchParams }: { searchParams: PageProps<"/app/revision">["searchParams"] }) {
  await requireUser("/app/revision");
  const [groups, query] = await Promise.all([listRevisionGrouped(), searchParams]);
  return <RevisionScreen {...groups} autoStart={query.start === "1"} />;
}

function RevisionSkeleton() {
  return (
    <div aria-hidden className="grid gap-6">
      <div className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
      <div className="h-48 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
    </div>
  );
}
