/**
 * Transcripts from TranscriptAPI (transcriptapi.com), for servers YouTube refuses (it answers
 * Vercel with "Sign in to confirm you're not a bot"). Used after the direct caption lookup fails,
 * with TRANSCRIPT_API_KEY set. A credit is charged only for a 200, so a 404 retry is free.
 *
 * GET /api/v2/youtube/transcript?video_url=<id>&format=json → { language, transcript: [{ text,
 * start, duration }], length_seconds }, start in seconds.
 */
import { z } from "zod";

import type { OutputLanguage } from "@/config/enums";
import type { TranscriptLine } from "@/lib/transcript/parse";

const API_URL = "https://transcriptapi.com/api/v2/youtube/transcript";
const TIMEOUT_MS = 20_000;

const ResponseSchema = z.object({
  transcript: z.array(z.object({ text: z.string(), start: z.number().min(0) })),
});

/** Response segments → transcript lines (whole seconds, in order, without empty text). Pure. */
export function linesFromTranscriptApi(body: unknown): TranscriptLine[] {
  const parsed = ResponseSchema.safeParse(body);
  if (!parsed.success) return [];
  return parsed.data.transcript
    .map((s) => ({ seconds: Math.floor(s.start), text: s.text.replace(/\s+/g, " ").trim() }))
    .filter((l) => l.text.length > 0)
    .sort((a, b) => a.seconds - b.seconds);
}

/**
 * The language list to ask for: the output language first (a plain code also accepts YouTube's
 * auto-generated track), then English. Without it the API picks English, else the first track.
 */
export function transcriptApiLanguages(output: OutputLanguage): string | null {
  const wanted = output === "hinglish" ? "hi" : output;
  return wanted === "en" ? null : `${wanted},en`;
}

async function request(videoId: string, apiKey: string, language: string | null): Promise<Response> {
  const url = new URL(API_URL);
  url.searchParams.set("video_url", videoId);
  url.searchParams.set("format", "json");
  url.searchParams.set("include_timestamp", "true");
  if (language) url.searchParams.set("language", language);
  return fetch(url, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
}

/** The video's transcript lines, or null if it has none, the key is wrong or credits ran out. */
export async function fetchTranscriptApiLines(videoId: string, apiKey: string, output: OutputLanguage): Promise<TranscriptLine[] | null> {
  try {
    const languages = transcriptApiLanguages(output);
    let response = await request(videoId, apiKey, languages);
    // None of the wanted languages: take the video's own track instead (404s cost nothing).
    if (response.status === 404 && languages) response = await request(videoId, apiKey, null);
    // 408 is the API's own "temporary failure, retry" (bot detection on its side); also free.
    if (response.status === 408 || response.status === 503) response = await request(videoId, apiKey, null);
    if (!response.ok) {
      const hint = response.status === 402 ? "(no credits left)" : response.status === 401 ? "(bad key)" : "";
      console.error("[transcriptapi] request failed:", response.status, hint);
      return null;
    }
    const lines = linesFromTranscriptApi(await response.json());
    return lines.length > 0 ? lines : null;
  } catch (error) {
    console.error("[transcriptapi] fetch failed:", error instanceof Error ? error.name : "unknown");
    return null;
  }
}
