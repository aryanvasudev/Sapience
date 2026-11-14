import { buildFeed } from "@/lib/calendar/feed";

/**
 * GET /api/calendar/feed/<token>.ics: the student's study plan as iCalendar, for Google Calendar
 * "From URL" subscriptions. The token is the only credential, so unknown tokens get a plain 404
 * and responses are never shared by caches.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/calendar/feed/[token]">) {
  const raw = (await ctx.params).token;
  const token = raw.endsWith(".ics") ? raw.slice(0, -4) : raw;
  try {
    const body = await buildFeed(token);
    if (body === null) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="sapience.ics"',
        "Cache-Control": "private, max-age=900",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error("[calendar] feed failed:", error instanceof Error ? error.name : "unknown");
    return new Response("Calendar unavailable", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
