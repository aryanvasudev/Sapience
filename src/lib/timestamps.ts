/**
 * `[mm:ss]` / `[h:mm:ss]` references in AI text → seekable chips (Section 11). Pure, unit tested.
 * References beyond the video's duration are left as plain text: never link an invented time.
 */
const TIMESTAMP_REF = /\[(\d{1,2}:)?(\d{1,2}):(\d{2})\]/g;

export function timestampToSeconds(h: string | undefined, m: string, s: string): number | null {
  const minutes = Number(m);
  const seconds = Number(s);
  if (seconds > 59 || (h !== undefined && minutes > 59)) return null;
  return Number(h ?? 0) * 3600 + minutes * 60 + seconds;
}

/** Rewrite valid references as Markdown links `[mm:ss](#t=SECONDS)`; the renderer turns those into chips. */
export function linkTimestamps(markdown: string, durationSeconds: number): string {
  return markdown.replace(TIMESTAMP_REF, (match, h: string | undefined, m: string, s: string, offset: number, whole: string) => {
    // Already a link (`[12:30](...)`): leave it.
    if (whole[offset + match.length] === "(") return match;
    const seconds = timestampToSeconds(h?.slice(0, -1), m, s);
    if (seconds === null || seconds > durationSeconds) return match;
    return `${match}(#t=${seconds})`;
  });
}

export function parseTimestampHref(href: string | undefined): number | null {
  const match = href ? /^#t=(\d+)$/.exec(href) : null;
  return match ? Number(match[1]) : null;
}

/** Timestamps are approximate: jump a little early (Section 5.3). */
export function seekTarget(seconds: number): number {
  return Math.max(0, seconds - 3);
}
