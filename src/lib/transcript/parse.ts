/**
 * Parse a transcript copied from YouTube's "Show transcript" panel (Section 5.8). Pure.
 *
 * Accepts both copy formats:
 *   "0:05 today we start with…"          (timestamp and text on one line)
 *   "0:05\ntoday we start with…"          (timestamp on its own line, text below)
 * plus h:mm:ss, the screen-reader lines YouTube sometimes includes ("2 minutes, 5 seconds"),
 * blank lines and anything before the first timestamp (dropped).
 */

export type TranscriptLine = { seconds: number; text: string };

export const MAX_TRANSCRIPT_BYTES = 200 * 1024;

const TIMESTAMP = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\s+(.*))?$/;
const SPOKEN_DURATION = /^\d+\s+(?:hours?|minutes?|seconds?)(?:,\s*\d+\s+(?:minutes?|seconds?))*$/i;

export function parseTimestamp(value: string): number | null {
  const match = TIMESTAMP.exec(value.trim());
  if (!match) return null;
  const [, h, m, s] = match;
  if (Number(s) > 59 || (h !== undefined && Number(m) > 59)) return null;
  return Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s);
}

export function parseTranscript(input: string): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  let current: TranscriptLine | null = null;

  const flush = () => {
    if (current && current.text.trim()) lines.push({ seconds: current.seconds, text: current.text.replace(/\s+/g, " ").trim() });
    current = null;
  };

  for (const rawLine of input.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.replace(/​/g, "").trim();
    if (!line || SPOKEN_DURATION.test(line)) continue;

    const match = TIMESTAMP.exec(line);
    const seconds = match ? parseTimestamp(`${match[1] ? `${match[1]}:` : ""}${match[2]}:${match[3]}`) : null;
    if (match && seconds !== null) {
      flush();
      current = { seconds, text: match[4] ?? "" };
      continue;
    }
    if (current) current.text += ` ${line}`;
    // Text before the first timestamp (titles, "Transcript", chapter headers) is ignored.
  }
  flush();

  // Keep chronological order; YouTube copies are already sorted, but be strict.
  return lines.sort((a, b) => a.seconds - b.seconds);
}
