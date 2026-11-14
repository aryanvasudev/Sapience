/**
 * Transcripts from youtube-transcript.ai, for servers YouTube refuses (it answers Vercel and
 * Cloudflare with "Sign in to confirm you're not a bot"). Used only after the direct caption
 * lookup fails, and only with YOUTUBE_TRANSCRIPT_AI_KEY set. The free plan allows 10 requests a
 * day, and every request counts, so callers never retry.
 *
 * The API returns Markdown: a header, then `[m:ss] text` paragraphs roughly 30 s apart, then a
 * footer after `---`. Paragraphs are split into short lines with times spread evenly across each
 * paragraph, so short videos still have enough lines and seeks land near the right sentence.
 */
import type { TranscriptLine } from "@/lib/transcript/parse";

const API_URL = "https://youtube-transcript.ai/transcript";
const TIMEOUT_MS = 15_000;
const WORDS_PER_LINE = 18;
const PARAGRAPH = /^\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]\s*(.*)$/;

type Paragraph = { seconds: number; text: string };

function paragraphs(markdown: string): Paragraph[] {
  let body = markdown.replace(/\r\n?/g, "\n");
  const start = body.indexOf("\n## Transcript");
  if (start !== -1) body = body.slice(start);
  const footer = body.search(/\n---\s*(\n|$)/);
  if (footer !== -1) body = body.slice(0, footer);

  const result: Paragraph[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const match = PARAGRAPH.exec(line);
    if (match) {
      const [, h, m, s, text] = match;
      if (Number(s) > 59 || (h !== undefined && Number(m) > 59)) continue;
      result.push({ seconds: Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s), text: text ?? "" });
    } else if (result.length > 0) {
      result[result.length - 1].text += ` ${line}`;
    }
  }
  return result.sort((a, b) => a.seconds - b.seconds);
}

/** The API's Markdown → transcript lines of about WORDS_PER_LINE words. Pure. */
export function parseTranscriptAi(markdown: string, durationSeconds: number): TranscriptLine[] {
  const paras = paragraphs(markdown);
  const lines: TranscriptLine[] = [];
  paras.forEach((para, i) => {
    const words = para.text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    if (words.length === 0) return;
    const end = Math.max(para.seconds, paras[i + 1]?.seconds ?? durationSeconds);
    const span = end - para.seconds;
    for (let w = 0; w < words.length; w += WORDS_PER_LINE) {
      const seconds = para.seconds + Math.floor((span * w) / words.length);
      const text = words.slice(w, w + WORDS_PER_LINE).join(" ");
      const previous = lines[lines.length - 1];
      // Two pieces can land on the same second in a short paragraph: keep one line per second.
      if (previous && previous.seconds === seconds) previous.text += ` ${text}`;
      else lines.push({ seconds, text });
    }
  });
  return lines;
}

/** The transcript Markdown, or null if the video has none, the key is wrong or the quota is used up. */
export async function fetchTranscriptAi(videoId: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/${videoId}.txt`, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (!response.ok) {
      console.error("[transcript-ai] request failed:", response.status, response.status === 429 ? "(daily quota used up)" : "");
      return null;
    }
    if (remaining !== null && Number(remaining) <= 2) console.warn("[transcript-ai] requests left today:", remaining);
    return await response.text();
  } catch (error) {
    console.error("[transcript-ai] fetch failed:", error instanceof Error ? error.name : "unknown");
    return null;
  }
}
