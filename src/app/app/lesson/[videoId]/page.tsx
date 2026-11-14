import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { OUTPUT_LANGUAGES, type OutputLanguage } from "@/config/enums";
import { BuildLessonPanel } from "@/features/lesson/components/build-lesson-panel";
import { LessonScreen } from "@/features/lesson/components/lesson-screen";
import { requireUser } from "@/lib/auth";
import { getLessonStatus } from "@/lib/lessons/service";
import { createClient } from "@/lib/supabase/server";
import { listNotes } from "@/lib/notes/service";
import { listWeakSpots } from "@/lib/weak-spots/service";
import { loadLatestConversation } from "@/lib/tutor/service";
import { parseStartTime } from "@/lib/youtube/parse-url";
import { getCachedVideo } from "@/lib/youtube/videos";
import { parsePreferences, YouTubeVideoId } from "@/types/contracts";

export const metadata: Metadata = { title: "Lesson" };

export default function LessonPage({ params, searchParams }: PageProps<"/app/lesson/[videoId]">) {
  return (
    <Suspense fallback={<LessonSkeleton />}>
      <LessonLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function LessonLoader({
  params,
  searchParams,
}: {
  params: PageProps<"/app/lesson/[videoId]">["params"];
  searchParams: PageProps<"/app/lesson/[videoId]">["searchParams"];
}) {
  const [{ videoId: rawId }, query] = await Promise.all([params, searchParams]);
  const id = YouTubeVideoId.safeParse(rawId);
  if (!id.success) notFound();
  const videoId = id.data;
  const user = await requireUser(`/app/lesson/${videoId}`);

  const supabase = await createClient();
  const [{ data: profile }, { data: progress }] = await Promise.all([
    supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle(),
    supabase.from("lesson_progress").select("last_position_seconds, output_language").eq("youtube_video_id", videoId).maybeSingle(),
  ]);

  const langParam = typeof query.lang === "string" ? query.lang : undefined;
  const language: OutputLanguage = (OUTPUT_LANGUAGES as readonly string[]).includes(langParam ?? "")
    ? (langParam as OutputLanguage)
    : ((OUTPUT_LANGUAGES as readonly string[]).includes(progress?.output_language ?? "")
        ? (progress?.output_language as OutputLanguage)
        : parsePreferences(profile?.preferences).language);

  const tParam = typeof query.t === "string" ? parseStartTime(query.t) : null;
  const startSeconds = tParam ?? progress?.last_position_seconds ?? 0;

  const [status, conversation, notes, weakSpots] = await Promise.all([
    getLessonStatus({ user, videoId, language }),
    loadLatestConversation(videoId),
    listNotes(videoId),
    listWeakSpots(videoId),
  ]);
  if (!status) {
    const video = await getCachedVideo(videoId);
    return <BuildLessonPanel videoId={videoId} language={language} title={video?.title ?? null} />;
  }
  const preferences = parsePreferences(profile?.preferences);
  return (
    <LessonScreen
      initial={status}
      videoId={videoId}
      language={language}
      startSeconds={startSeconds}
      pauseForCheckpoints={preferences.pauseForCheckpoints}
      askWhyPaused={preferences.askWhyPaused}
      defaultStyle={preferences.defaultStyle}
      initialMessages={conversation?.messages ?? []}
      initialNotes={notes}
      initialWeakSpots={weakSpots}
    />
  );
}

const PULSE = "animate-pulse bg-muted motion-reduce:animate-none";

/** Mirrors the lesson screen: player, timeline, title and chapters; tabs and a panel on the right. */
function LessonSkeleton() {
  return (
    <div aria-hidden className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem] xl:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="grid min-w-0 content-start gap-6">
        <div className="-mx-4 md:mx-0">
          <div className={`aspect-video md:rounded-2xl ${PULSE}`} />
          <div className="mt-4 flex gap-1 px-4 md:px-0">
            {[3, 5, 4, 6, 2].map((grow, i) => (
              <div key={i} className={`h-1.5 rounded-full ${PULSE}`} style={{ flexGrow: grow }} />
            ))}
          </div>
        </div>
        <div className="grid gap-2.5">
          <div className={`h-7 w-2/3 rounded-md ${PULSE}`} />
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
        </div>
        <div className={`hidden h-56 rounded-2xl lg:block ${PULSE}`} />
      </div>
      <div className="grid content-start gap-5">
        <div className={`h-10 rounded-[10px] ${PULSE}`} />
        <div className="grid gap-2.5">
          <div className={`h-5 w-1/2 rounded ${PULSE}`} />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
        </div>
        <div className={`h-32 rounded-2xl ${PULSE}`} />
      </div>
    </div>
  );
}
