import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { CalendarBodySkeleton, CalendarScreen } from "@/features/calendar/components/calendar-screen";
import { requireUser } from "@/lib/auth";
import { loadCalendarData } from "@/lib/calendar/service";
import { listOpenedLessons } from "@/lib/library/service";

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

async function CalendarLoader() {
  const user = await requireUser("/app/calendar");
  const [{ events, deadlines, revisionDue }, lessons] = await Promise.all([loadCalendarData(), listOpenedLessons()]);

  return (
    <CalendarScreen
      initialEvents={events}
      deadlines={deadlines}
      revisionDue={revisionDue}
      lectures={(lessons ?? []).map((l) => ({ videoId: l.videoId, title: l.title, positionSeconds: l.positionSeconds }))}
      isAnonymous={user.isAnonymous}
    />
  );
}
