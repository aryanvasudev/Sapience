import type { Metadata } from "next";
import { Suspense } from "react";

import { LessonRow } from "@/components/shared/lesson-row";
import { ConceptList } from "@/features/library/components/concept-list";
import { requireUser } from "@/lib/auth";
import { listOpenedLessons, listSavedConcepts } from "@/lib/library/service";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <div className="grid gap-12">
      <header>
        <h1 className="font-serif text-title font-medium">Library</h1>
        <p className="mt-3 text-[0.9375rem] text-muted-foreground">Every lecture you&apos;ve opened and everything you&apos;ve saved.</p>
      </header>
      <Suspense fallback={<LibrarySkeleton />}>
        <LibraryLoader />
      </Suspense>
    </div>
  );
}

async function LibraryLoader() {
  await requireUser("/app/library");
  const [lessons, concepts] = await Promise.all([listOpenedLessons(), listSavedConcepts()]);

  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:gap-10">
      <section aria-labelledby="lessons-heading" className="min-w-0">
        <h2 id="lessons-heading" className="font-serif text-xl font-medium">
          Lessons
          {lessons?.length ? <span className="ml-2 text-base text-muted-foreground tabular-nums">{lessons.length}</span> : null}
        </h2>
        <div className="mt-4">
          {lessons === null ? (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t load your lessons. Refresh the page to try again.
            </p>
          ) : lessons.length === 0 ? (
            <div className="rounded-[14px] border border-dashed p-6">
              <p className="text-[0.9375rem]">Lectures you open will show up here, with where you stopped.</p>
            </div>
          ) : (
            <ul className="divide-y overflow-hidden rounded-[14px] border bg-card">
              {lessons.map((l) => (
                <li key={l.videoId}>
                  <LessonRow item={l} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="concepts-heading" className="min-w-0">
        <h2 id="concepts-heading" className="font-serif text-xl font-medium">
          Saved concepts
          {concepts?.length ? <span className="ml-2 text-base text-muted-foreground tabular-nums">{concepts.length}</span> : null}
        </h2>
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
      {[0, 1].map((i) => (
        <div key={i} className="grid gap-4">
          <div className="h-6 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-48 animate-pulse rounded-[14px] bg-muted motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
