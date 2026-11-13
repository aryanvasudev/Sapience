import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { RevisionScreen } from "@/features/revision/components/revision-screen";
import { requireUser } from "@/lib/auth";
import { listRevisionGrouped } from "@/lib/revision/service";

export const metadata: Metadata = { title: "Revision" };

export default function RevisionPage({ searchParams }: PageProps<"/app/revision">) {
  return (
    <div className="grid gap-10">
      <PageHeader
        title="Revision"
        description="What you saved comes back just before you'd forget it. Rate each one honestly and the gaps adjust."
      />
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
    <div aria-hidden className="grid max-w-3xl gap-8">
      <div className="h-32 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      <div className="grid gap-3">
        <div className="h-10 max-w-md animate-pulse rounded-[10px] bg-muted motion-reduce:animate-none" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted/70 motion-reduce:animate-none" />
      </div>
    </div>
  );
}
