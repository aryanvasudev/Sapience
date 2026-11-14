/**
 * A small iCalendar (RFC 5545) writer for the study-plan subscription feed. Pure: no I/O, so it
 * is unit-tested directly (tests/unit/calendar-ics.test.ts).
 *
 * - Text values are escaped (backslash, semicolon, comma, newline).
 * - Lines end in CRLF and are folded at 75 octets without splitting a UTF-8 character.
 * - Timed events are written in UTC; all-day events use VALUE=DATE with an exclusive end date.
 */
import { icsUtc } from "./links";

type IcsBase = {
  /** Stable across feed refreshes, e.g. "<row id>@sapience". */
  uid: string;
  title: string;
  description?: string | null;
  url?: string | null;
};

export type IcsEvent =
  | (IcsBase & { allDay?: false; start: Date | string; end: Date | string })
  | (IcsBase & { allDay: true; /** YYYY-MM-DD */ date: string });

export type IcsCalendar = {
  name: string;
  description?: string;
  events: IcsEvent[];
  /** DTSTAMP for every event (defaults to now). */
  now?: Date;
};

export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/** Fold one content line at 75 octets; continuation lines start with a single space. */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
      limit = 74; // the leading space of a continuation line counts toward its 75 octets
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** "2026-11-13" → "20261113" */
const icsDate = (day: string) => day.replace(/-/g, "");

/** The day after a YYYY-MM-DD date, as YYYY-MM-DD (all-day DTEND is exclusive). */
export function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1));
  return date.toISOString().slice(0, 10);
}

export function buildIcsCalendar(calendar: IcsCalendar): string {
  const stamp = icsUtc(calendar.now ?? new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sapience//Study plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendar.name)}`,
    ...(calendar.description ? [`X-WR-CALDESC:${escapeIcsText(calendar.description)}`] : []),
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const event of calendar.events) {
    lines.push("BEGIN:VEVENT", `UID:${escapeIcsText(event.uid)}`, `DTSTAMP:${stamp}`);
    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(event.date)}`, `DTEND;VALUE=DATE:${icsDate(nextDay(event.date))}`, "TRANSP:TRANSPARENT");
    } else {
      lines.push(`DTSTART:${icsUtc(event.start)}`, `DTEND:${icsUtc(event.end)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    // URI values are not TEXT: no escaping, but keep them free of line breaks.
    if (event.url) lines.push(`URL:${event.url.replace(/[\r\n]/g, "")}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** "2026-11-13" for an instant, in a time zone (the app counts days in Asia/Kolkata). */
export function dayInTimeZone(date: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
}
