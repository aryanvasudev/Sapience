import Link from "next/link";

import { ArrowForwardIcon, EventRepeatIcon } from "@/components/icons";
import { SectionHeading } from "@/components/layout/page-header";
import { CountUp } from "@/components/motion/count-up";
import { LessonCard, LessonRow } from "@/components/shared/lesson-row";
import { Button } from "@/components/ui/button";
import { OUTPUT_LANGUAGES, type OutputLanguage } from "@/config/enums";
import { requireUser } from "@/lib/auth";
import { listFeatured, type FeaturedLesson } from "@/lib/library/service";
import { createClient, privateCacheLife, privateData, privateLoader } from "@/lib/supabase/server";

export type ContinueItem = {
  videoId: string;
  language: OutputLanguage;
  positionSeconds: number;
  title: string;
  channel: string | null;
  durationSeconds: number;
  thumbnailUrl: string | null;
};

/** Featured lessons, continue learning and due reviews. Real data from the user's own rows (RLS). */
export async function DashboardSections() {
  return <DashboardSectionsView {...await loadDashboard()} />;
}

/** Cached in the browser for the session, so the page opens with its data (see `privateData`). */
async function loadDashboardCached() {
  "use cache: private";
  privateCacheLife();
  return privateData(loadDashboardRows);
}

// Declared after the cached function: the "use cache" compiler turns it into a binding that
// isn't hoisted, so it has to exist before privateLoader reads it.
const loadDashboard = privateLoader(loadDashboardCached, loadDashboardRows);

async function loadDashboardRows() {
  await requireUser();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [progress, due, featured, stats] = await Promise.all([
    supabase
      .from("lesson_progress")
      .select(
        "youtube_video_id, output_language, last_position_seconds, updated_at, videos(title, channel_title, duration_seconds, thumbnail_url)",
      )
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase.from("revision_items").select("id", { count: "exact", head: true }).lte("due_at", nowIso),
    listFeatured(),
    studyStats(),
  ]);

  const loadFailed = Boolean(progress.error || due.error);
  const items: ContinueItem[] = (progress.data ?? []).flatMap((row) => {
    if (!row.videos) return [];
    const language = (OUTPUT_LANGUAGES as readonly string[]).includes(row.output_language)
      ? (row.output_language as OutputLanguage)
      : "en";
    return [
      {
        videoId: row.youtube_video_id,
        language,
        positionSeconds: row.last_position_seconds,
        title: row.videos.title,
        channel: row.videos.channel_title,
        durationSeconds: row.videos.duration_seconds,
        thumbnailUrl: row.videos.thumbnail_url,
      },
    ];
  });
  const dueCount = due.count ?? 0;

  return { items, featured, dueCount, loadFailed, stats };
}

export type StudyStats = { answered: number; firstTryCorrect: number; conceptsSaved: number; reviewsDone: number };

/** P1 stats (Section 5.12). Counts only; no "hours watched" headline. */
async function studyStats(): Promise<StudyStats | null> {
  const supabase = await createClient();
  const [attempts, concepts, reviews] = await Promise.all([
    supabase.from("question_attempts").select("question_id, is_correct").order("created_at", { ascending: true }).limit(5000),
    supabase.from("concepts").select("id", { count: "exact", head: true }),
    supabase.from("revision_reviews").select("id", { count: "exact", head: true }),
  ]);
  if (attempts.error || concepts.error || reviews.error) return null;
  const first = new Map<string, boolean>();
  for (const a of attempts.data) if (!first.has(a.question_id)) first.set(a.question_id, a.is_correct);
  return {
    answered: first.size,
    firstTryCorrect: [...first.values()].filter(Boolean).length,
    conceptsSaved: concepts.count ?? 0,
    reviewsDone: reviews.count ?? 0,
  };
}


/** The rendered sections, separate from the queries so the layout can be previewed with sample rows. */
export function DashboardSectionsView({
  items,
  featured = [],
  dueCount,
  loadFailed,
  stats = null,
}: {
  items: ContinueItem[];
  featured?: FeaturedLesson[];
  dueCount: number;
  loadFailed: boolean;
  stats?: StudyStats | null;
}) {
  const opened = new Set(items.map((i) => `${i.videoId}:${i.language}`));
  const fresh = featured.filter((f) => !opened.has(`${f.videoId}:${f.language}`));
  const showStats = stats !== null && stats.answered + stats.conceptsSaved + stats.reviewsDone > 0;
  return (
    <div className="enter grid gap-10 [--i:2] lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
      <div className="grid min-w-0 content-start gap-12">
        <section aria-labelledby="continue-heading">
          <SectionHeading id="continue-heading" meta={items.length > 0 ? `${items.length} recent` : undefined}>
            Continue learning
          </SectionHeading>
          {loadFailed ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              Couldn&apos;t load your lessons. Refresh the page to try again.
            </p>
          ) : items.length === 0 ? (
            <div className="mt-4 grid place-items-start gap-1 rounded-2xl border border-dashed p-6">
              <p className="text-[0.9375rem] font-medium">No lectures yet</p>
              <p className="text-sm text-muted-foreground">Lectures you open show up here, with where you stopped.</p>
            </div>
          ) : (
            <ul className="mt-3 -mx-2.5 grid gap-0.5">
              {items.map((item) => (
                <li key={item.videoId}>
                  {/* At most six: prefetched in full, so the lesson you were in opens instantly. */}
                  <LessonRow item={item} prefetch />
                </li>
              ))}
            </ul>
          )}
        </section>

        {fresh.length ? (
          <section aria-labelledby="featured-heading">
            <SectionHeading id="featured-heading">Ready to open</SectionHeading>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">
              Already built, so they open straight away and don&apos;t use your daily lesson.
            </p>
            <ul className="mt-5 grid gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">
              {fresh.map((item) => (
                <li key={`${item.videoId}-${item.language}`}>
                  <LessonCard item={item} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="grid content-start gap-10">
        <section aria-labelledby="revision-heading">
          <SectionHeading id="revision-heading">Revision</SectionHeading>
          <div className="mt-3 rounded-2xl border bg-card p-5 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
            <p className="flex items-baseline gap-2">
              <span className="text-[2.25rem] leading-none font-semibold tracking-[-0.03em] tabular-nums">
                {loadFailed ? "–" : <CountUp value={dueCount} />}
              </span>
              <span className="text-sm text-muted-foreground">{dueCount === 1 ? "concept due" : "concepts due"}</span>
            </p>
            {dueCount === 0 || loadFailed ? (
              <p className="mt-4 flex gap-2.5 border-t pt-4 text-[0.8125rem] leading-relaxed text-muted-foreground">
                <EventRepeatIcon className="mt-px size-4.5 shrink-0 text-faint" />
                Nothing to review. Questions you save from a lesson come back here on a spaced schedule.
              </p>
            ) : (
              <Button asChild className="mt-5 w-full">
                <Link href="/app/revision?start=1">
                  Start revision
                  <ArrowForwardIcon data-icon="inline-end" />
                </Link>
              </Button>
            )}
          </div>
        </section>

        {showStats && stats ? (
          <section aria-labelledby="stats-heading">
            <SectionHeading id="stats-heading">Your study</SectionHeading>
            <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border">
              <StatTile label="Checkpoints answered" value={stats.answered} />
              <StatTile
                label="Right first time"
                value={stats.answered ? Math.round((stats.firstTryCorrect / stats.answered) * 100) : null}
                suffix="%"
              />
              <StatTile label="Concepts saved" value={stats.conceptsSaved} />
              <StatTile label="Reviews done" value={stats.reviewsDone} />
            </dl>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function StatTile({ label, value, suffix = "" }: { label: string; value: number | null; suffix?: string }) {
  return (
    <div className="grid gap-1.5 bg-card p-4">
      <dt className="order-2 text-xs text-muted-foreground">{label}</dt>
      <dd className="order-1 text-2xl leading-none font-semibold tracking-[-0.02em] tabular-nums">
        {value === null ? "–" : <CountUp value={value} suffix={suffix} />}
      </dd>
    </div>
  );
}

export function DashboardSectionsSkeleton() {
  return (
    <div aria-hidden className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
      <div className="grid content-start gap-3">
        <div className="h-5 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 p-2.5">
            <div className="aspect-video w-36 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
            <div className="grid flex-1 gap-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid content-start gap-3">
        <div className="h-5 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-36 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      </div>
    </div>
  );
}
