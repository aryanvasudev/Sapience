/**
 * Calendar days in the browser's local time zone, as "YYYY-MM-DD" keys. Only call these on the
 * client (after mount): the server's time zone isn't the student's.
 */

const pad = (n: number) => String(n).padStart(2, "0");

export const dayKey = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Local midnight of a day key. */
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(key: string, days: number): string {
  const date = fromDayKey(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

export type MonthView = { year: number; month: number };

export const monthOf = (key: string): MonthView => {
  const date = fromDayKey(key);
  return { year: date.getFullYear(), month: date.getMonth() };
};

export function shiftMonth(view: MonthView, delta: number): MonthView {
  const date = new Date(view.year, view.month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** 42 day keys (six weeks, Monday first) covering the month. */
export function monthGrid(view: MonthView): string[] {
  const first = new Date(view.year, view.month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(view.year, view.month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
}

const timeFormat = () => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function formatTimeRange(startsAt: string, endsAt: string): string {
  const f = timeFormat();
  return `${f.format(new Date(startsAt))}–${f.format(new Date(endsAt))}`;
}

export const formatTime = (iso: string): string => timeFormat().format(new Date(iso));

/** "Today", "Tomorrow", "Yesterday", or "Thu 13 Nov". */
export function formatDayLabel(key: string, today: string): string {
  if (key === today) return "Today";
  if (key === addDays(today, 1)) return "Tomorrow";
  if (key === addDays(today, -1)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(fromDayKey(key));
}

export const formatLongDay = (key: string): string =>
  new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(fromDayKey(key));

export const formatMonth = (view: MonthView): string =>
  new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(view.year, view.month, 1));
