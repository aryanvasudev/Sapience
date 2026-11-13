import Link from "next/link";

import { EventRepeatIcon } from "@/components/icons";
import { LessonRow } from "@/components/shared/lesson-row";
import { Button } from "@/components/ui/button";
import { OUTPUT_LANGUAGES, type OutputLanguage } from "@/config/enums";
import { requireUser } from "@/lib/auth";
import { listFeatured, type FeaturedLesson } from "@/lib/library/service";
import { createClient } from "@/lib/supabase/server";

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

  return <DashboardSectionsView items={items} featured={featured} dueCount={dueCount} loadFailed={loadFailed} stats={stats} />;
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
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
      <div className="grid min-w-0 content-start gap-12">
      <section aria-labelledby="continue-heading">
        <h2 id="continue-heading" className="font-serif text-xl font-medium">
          Continue learning
        </h2>
        {loadFailed ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            Couldn&apos;t load your lessons. Refresh the page to try again.
          </p>
        ) : items.length === 0 ? (
          <div className="mt-4 rounded-[14px] border border-dashed p-6">
            <p className="text-[0.9375rem]">Lectures you open will show up here, with where you stopped.</p>
          </div>
        ) : (
          <ul className="mt-4 divide-y overflow-hidden rounded-[14px] border bg-card">
            {items.map((item) => (
              <li key={item.videoId}>
                <LessonRow item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {fresh.length ? (
        <section aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="font-serif text-xl font-medium">
            Ready to open
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Already built, so they open straight away and don&apos;t use your daily lesson.</p>
          <ul className="mt-4 divide-y overflow-hidden rounded-[14px] border bg-card">
            {fresh.map((item) => (
              <li key={`${item.videoId}-${item.language}`}>
                <LessonRow item={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      </div>

      <div className="grid content-start gap-12">
      <section aria-labelledby="revision-heading">
        <h2 id="revision-heading" className="font-serif text-xl font-medium">
          Revision
        </h2>
        <div className="mt-4 rounded-[14px] border bg-card p-5">
          <p className="flex items-baseline gap-2">
            <span className="font-serif text-[2rem] leading-none font-medium tabular-nums">{loadFailed ? "–" : dueCount}</span>
            <span className="text-sm text-muted-foreground">{dueCount === 1 ? "concept due" : "concepts due"}</span>
          </p>
          {dueCount === 0 || loadFailed ? (
            <p className="mt-3 flex gap-2 text-sm text-muted-foreground">
              <EventRepeatIcon className="mt-px size-4.5 shrink-0" />
              Nothing to review. Questions you save from a lesson come back here on a spaced schedule.
            </p>
          ) : (
            <Button asChild className="mt-4 w-full">
              <Link href="/app/revision?start=1">Start revision</Link>
            </Button>
          )}
        </div>
      </section>

      {stats && stats.answered + stats.conceptsSaved + stats.reviewsDone > 0 ? (
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="font-serif text-xl font-medium">
            Your study
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <StatTile label="Checkpoints answered" value={stats.answered} />
            <StatTile
              label="Right first time"
              value={stats.answered ? `${Math.round((stats.firstTryCorrect / stats.answered) * 100)}%` : "–"}
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

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="grid gap-0.5 rounded-[14px] border bg-card p-4">
      <dt className="order-2 text-xs text-muted-foreground">{label}</dt>
      <dd className="order-1 font-serif text-2xl leading-none font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function DashboardSectionsSkeleton() {
  return (
    <div aria-hidden className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
      <div className="grid gap-4">
        <div className="h-6 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-24 animate-pulse rounded-[14px] bg-muted motion-reduce:animate-none" />
      </div>
      <div className="grid gap-4">
        <div className="h-6 w-28 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-32 animate-pulse rounded-[14px] bg-muted motion-reduce:animate-none" />
      </div>
    </div>
  );
}
