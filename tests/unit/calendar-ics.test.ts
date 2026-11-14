import { describe, expect, it } from "vitest";

import { buildIcsCalendar, dayInTimeZone, escapeIcsText, foldIcsLine, nextDay } from "@/lib/calendar/ics";
import { googleCalendarUrl, icsUtc, lessonPath } from "@/lib/calendar/links";

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe("escapeIcsText", () => {
  it("escapes backslashes, semicolons, commas and newlines", () => {
    expect(escapeIcsText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });
});

describe("foldIcsLine", () => {
  it("leaves short lines alone", () => {
    expect(foldIcsLine("SUMMARY:Short")).toBe("SUMMARY:Short");
  });

  it("folds at 75 octets with a leading space on continuation lines", () => {
    const line = `DESCRIPTION:${"x".repeat(200)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(bytes(part)).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(line);
  });

  it("never splits a multi-byte character", () => {
    const line = `SUMMARY:${"गणित ".repeat(30)}`;
    const parts = foldIcsLine(line).split("\r\n");
    for (const part of parts) {
      expect(bytes(part)).toBeLessThanOrEqual(75);
      expect(part).not.toContain("�");
    }
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(line);
  });
});

describe("buildIcsCalendar", () => {
  const now = new Date("2026-11-13T10:00:00Z");
  const ics = buildIcsCalendar({
    name: "Sapience study plan",
    now,
    events: [
      {
        uid: "e1@sapience",
        title: "Study: Fourier series, part 2",
        description: "Line one\nLine two",
        url: "https://sapience.example/app/lesson/abcdefghijk?t=760",
        start: "2026-11-14T12:30:00Z",
        end: "2026-11-14T13:30:00Z",
      },
      { uid: "g1@sapience", allDay: true, date: "2026-11-30", title: "Physics room: finish lecture 4" },
    ],
  });

  it("uses CRLF line endings throughout", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("writes the calendar header and refresh hints", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:Sapience study plan\r\n");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H\r\n");
    expect(ics).toContain("END:VCALENDAR\r\n");
  });

  it("writes timed events in UTC with escaped text", () => {
    expect(ics).toContain("UID:e1@sapience\r\n");
    expect(ics).toContain("DTSTAMP:20261113T100000Z\r\n");
    expect(ics).toContain("DTSTART:20261114T123000Z\r\n");
    expect(ics).toContain("DTEND:20261114T133000Z\r\n");
    expect(ics).toContain("SUMMARY:Study: Fourier series\\, part 2\r\n");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\r\n");
    expect(ics).toContain("URL:https://sapience.example/app/lesson/abcdefghijk?t=760\r\n");
  });

  it("writes all-day events with an exclusive end date", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20261130\r\nDTEND;VALUE=DATE:20261201\r\n");
  });

  it("balances BEGIN and END", () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2);
  });
});

describe("date helpers", () => {
  it("nextDay crosses month and year ends", () => {
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
  });

  it("dayInTimeZone uses the zone's calendar day", () => {
    // 20:00 UTC is already the next morning in India.
    expect(dayInTimeZone("2026-11-13T20:00:00Z", "Asia/Kolkata")).toBe("2026-11-14");
    expect(dayInTimeZone("2026-11-13T17:00:00Z", "Asia/Kolkata")).toBe("2026-11-13");
  });
});

describe("links", () => {
  it("icsUtc drops separators and milliseconds", () => {
    expect(icsUtc("2026-11-14T12:30:15.123Z")).toBe("20261114T123015Z");
  });

  it("googleCalendarUrl prefills the event", () => {
    const url = new URL(
      googleCalendarUrl({
        title: "Study session",
        startsAt: "2026-11-14T12:30:00Z",
        endsAt: "2026-11-14T13:30:00Z",
        details: "Chapter 3",
        url: "https://sapience.example/app/lesson/abcdefghijk?t=60",
      }),
    );
    expect(url.origin).toBe("https://calendar.google.com");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Study session");
    expect(url.searchParams.get("dates")).toBe("20261114T123000Z/20261114T133000Z");
    expect(url.searchParams.get("details")).toBe("Chapter 3\n\nOpen in Sapience: https://sapience.example/app/lesson/abcdefghijk?t=60");
  });

  it("lessonPath adds the timestamp only when there is one", () => {
    expect(lessonPath("abcdefghijk")).toBe("/app/lesson/abcdefghijk");
    expect(lessonPath("abcdefghijk", 0)).toBe("/app/lesson/abcdefghijk");
    expect(lessonPath("abcdefghijk", 75.6)).toBe("/app/lesson/abcdefghijk?t=75");
  });
});
