import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { CalendarBodySkeleton, CalendarScreen } from "@/features/calendar/components/calendar-screen";
import { requireUser } from "@/lib/auth";
import { loadCalendarData } from "@/lib/calendar/service";
import { listOpenedLessons } from "@/lib/library/service";
import { privateCacheLife, privateData, privateLoader } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-10">
          <PageHeader title="Calendar" description="Plan when you'll study. Room deadlines and revision days show up here on their own." />
          <CalendarBodySkeleton />
        </div>
      }
    >
      <CalendarLoader />
    </Suspense>
  );
}

/** Cached in the browser for the session, so the page opens with its data (see `privateData`). */
async function loadCalendarCached() {
  "use cache: private";
  privateCacheLife();
  return privateData(() => loadCalendarFresh());
}

// Declared after the cached function: the "use cache" compiler turns it into a binding that
// isn't hoisted, so it has to exist before privateLoader reads it.
const loadCalendar = privateLoader(loadCalendarCached, loadCalendarFresh);

async function loadCalendarFresh() {
  const user = await requireUser("/app/calendar");
  const [data, lessons] = await Promise.all([loadCalendarData(), listOpenedLessons()]);
  return { ...data, lessons, isAnonymous: user.isAnonymous };
}

async function CalendarLoader() {
  const { events, deadlines, revisionDue, lessons, isAnonymous } = await loadCalendar();

  return (
    <CalendarScreen
      initialEvents={events}
      deadlines={deadlines}
      revisionDue={revisionDue}
      lectures={(lessons ?? []).map((l) => ({ videoId: l.videoId, title: l.title, positionSeconds: l.positionSeconds }))}
      isAnonymous={isAnonymous}
    />
  );
}
