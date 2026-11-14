/**
 * Calendar links that work without any Google sign-in (safe on client and server).
 *
 * - `googleCalendarUrl`: Google Calendar's "create event" template, prefilled. One click adds a
 *   single event to the student's own Google Calendar.
 * - The iCalendar subscription feed (/api/calendar/feed/<token>) keeps Google Calendar in sync
 *   with everything in Sapience's calendar; see src/app/api/calendar/feed.
 */

export type CalendarLinkEvent = {
  title: string;
  startsAt: string | Date;
  endsAt: string | Date;
  details?: string | null;
  /** Absolute URL, e.g. the lesson at its timestamp. */
  url?: string | null;
};

/** 20261113T153000Z */
export function icsUtc(date: string | Date): string {
  return new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(event: CalendarLinkEvent): string {
  const details = [event.details?.trim(), event.url ? `Open in Sapience: ${event.url}` : null].filter(Boolean).join("\n\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${icsUtc(event.startsAt)}/${icsUtc(event.endsAt)}`,
  });
  if (details) params.set("details", details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Path of a lesson, optionally at a timestamp. */
export function lessonPath(videoId: string, seconds?: number | null): string {
  return seconds && seconds > 0 ? `/app/lesson/${videoId}?t=${Math.floor(seconds)}` : `/app/lesson/${videoId}`;
}
