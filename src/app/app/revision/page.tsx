import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { RevisionScreen } from "@/features/revision/components/revision-screen";
import { requireUser } from "@/lib/auth";
import { listRevisionGrouped } from "@/lib/revision/service";
import { privateCacheLife, privateData, privateLoader } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Revision" };

export default function RevisionPage() {
  return (
    <div className="grid gap-10">
      <PageHeader
        title="Revision"
        description="What you saved comes back just before you'd forget it. Rate each one honestly and the gaps adjust."
      />
      <Suspense fallback={<RevisionSkeleton />}>
        <RevisionLoader />
      </Suspense>
    </div>
  );
}

// RevisionScreen reads `?start=1` (Start revision) in the browser, so the page doesn't wait on the
// URL and its data can be prefetched with the route.
async function RevisionLoader() {
  return <RevisionScreen {...await loadRevision()} />;
}

/** Cached in the browser for the session, so the page opens with its data (see `privateData`). */
async function loadRevisionCached() {
  "use cache: private";
  privateCacheLife();
  return privateData(() => loadRevisionFresh());
}

// Declared after the cached function: the "use cache" compiler turns it into a binding that
// isn't hoisted, so it has to exist before privateLoader reads it.
const loadRevision = privateLoader(loadRevisionCached, loadRevisionFresh);

async function loadRevisionFresh() {
  await requireUser("/app/revision");
  return listRevisionGrouped();
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
