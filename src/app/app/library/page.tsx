import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader, SectionHeading } from "@/components/layout/page-header";
import { ConceptList } from "@/features/library/components/concept-list";
import { LessonList } from "@/features/library/components/lesson-list";
import { requireUser } from "@/lib/auth";
import { listOpenedLessons, listSavedConcepts } from "@/lib/library/service";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <div className="grid gap-10 md:gap-12">
      <PageHeader title="Library" description="Every lecture you've opened and everything you've saved." />
      <Suspense fallback={<LibrarySkeleton />}>
        <LibraryLoader />
      </Suspense>
    </div>
  );
}

const count = (n: number | undefined) =>
  n ? <span className="font-mono text-[0.8125rem] text-faint tabular-nums">{n}</span> : undefined;

async function LibraryLoader() {
  await requireUser("/app/library");
  const [lessons, concepts] = await Promise.all([listOpenedLessons(), listSavedConcepts()]);

  return (
    <div className="enter grid gap-12 [--i:1] lg:grid-cols-2 lg:gap-10">
      <section aria-labelledby="lessons-heading" className="min-w-0">
        <SectionHeading id="lessons-heading" meta={count(lessons?.length)}>
          Lessons
        </SectionHeading>
        <div className="mt-4">
          {lessons === null ? (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t load your lessons. Refresh the page to try again.
            </p>
          ) : lessons.length === 0 ? (
            <div className="grid gap-1 rounded-2xl border border-dashed p-6">
              <p className="text-[0.9375rem] font-medium">No lectures yet</p>
              <p className="text-sm text-muted-foreground">Lectures you open show up here, with where you stopped.</p>
            </div>
          ) : (
            <LessonList lessons={lessons} />
          )}
        </div>
      </section>

      <section aria-labelledby="concepts-heading" className="min-w-0">
        <SectionHeading id="concepts-heading" meta={count(concepts?.length)}>
          Saved concepts
        </SectionHeading>
        <div className="mt-4">
          {concepts === null ? (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t load your saved concepts. Refresh the page to try again.
            </p>
          ) : (
            <ConceptList concepts={concepts} />
          )}
        </div>
      </section>
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div aria-hidden className="grid gap-12 lg:grid-cols-2 lg:gap-10">
      <div className="grid content-start gap-3">
        <div className="h-5 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 py-2.5">
            <div className="aspect-video w-28 animate-pulse rounded-lg bg-muted motion-reduce:animate-none sm:w-36" />
            <div className="grid flex-1 gap-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid content-start gap-3">
        <div className="h-5 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-56 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      </div>
    </div>
  );
}
