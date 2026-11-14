/**
 * A public video's YouTube captions as timestamped transcript lines, so a lesson can be built
 * with a text model instead of the video model. Uses YouTube's own player endpoint with the
 * Android client, then the iOS one (both get caption URLs that need no proof-of-origin token).
 * Unofficial: YouTube may change or block it, so every failure returns null and the caller falls
 * back. YouTube is known to refuse some cloud servers; the logs say which reason it gave.
 */
import type { OutputLanguage } from "@/config/enums";
import type { TranscriptLine } from "@/lib/transcript/parse";

const PLAYER_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const CLIENTS = [
  { clientName: "ANDROID", clientVersion: "20.10.38", hl: "en" },
  {
    clientName: "IOS",
    clientVersion: "20.10.4",
    deviceMake: "Apple",
    deviceModel: "iPhone16,2",
    osName: "iPhone",
    osVersion: "18.3.2.22D82",
    hl: "en",
  },
] as const;
const TIMEOUT_MS = 8_000;

export type CaptionTrack = { baseUrl: string; languageCode: string; kind?: string };

type Json3 = { events?: { tStartMs?: number; segs?: { utf8?: string }[] }[] };

const base = (code: string) => code.toLowerCase().split("-")[0];

/**
 * The best track for a lesson in `output`: a human-made track in the output language, then a
 * human-made track in the spoken language (the auto-generated track's language), then the
 * auto-generated track, then any human-made track.
 */
export function pickCaptionTrack(tracks: CaptionTrack[], output: OutputLanguage): CaptionTrack | null {
  const wanted = output === "hinglish" ? "hi" : output;
  const manual = tracks.filter((t) => t.kind !== "asr");
  const auto = tracks.find((t) => t.kind === "asr");
  return (
    manual.find((t) => base(t.languageCode) === wanted) ??
    (auto ? manual.find((t) => base(t.languageCode) === base(auto.languageCode)) : undefined) ??
    auto ??
    manual[0] ??
    null
  );
}

/** YouTube's json3 caption format → transcript lines, in order, without empty events. */
export function parseJson3(data: Json3): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  for (const event of data.events ?? []) {
    if (event.tStartMs === undefined || !event.segs) continue;
    const text = event.segs
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (text) lines.push({ seconds: Math.floor(event.tStartMs / 1000), text });
  }
  return lines.sort((a, b) => a.seconds - b.seconds);
}

type PlayerResponse = {
  playabilityStatus?: { status?: string; reason?: string };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
};

/** Caption tracks from the first client YouTube answers with any, or null. */
async function captionTracks(videoId: string): Promise<CaptionTrack[] | null> {
  for (const client of CLIENTS) {
    try {
      const player = await fetch(PLAYER_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context: { client }, videoId }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!player.ok) {
        console.error(`[captions] ${client.clientName} player request failed:`, player.status);
        continue;
      }
      const body = (await player.json()) as PlayerResponse;
      const tracks = body.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      if (tracks.length > 0) return tracks;
      const status = body.playabilityStatus?.status;
      // A playable video without tracks really has no captions; another client won't find any.
      if (status === "OK") return null;
      // Not OK usually means YouTube is refusing this server (e.g. "Sign in to confirm you're not a bot").
      console.error(`[captions] ${client.clientName} player status:`, status, (body.playabilityStatus?.reason ?? "").slice(0, 120));
    } catch (error) {
      console.error(`[captions] ${client.clientName} player fetch failed:`, error instanceof Error ? error.name : "unknown");
    }
  }
  return null;
}

/** The video's captions as transcript lines, or null if it has none or YouTube can't be reached. */
export async function fetchCaptionLines(videoId: string, output: OutputLanguage): Promise<TranscriptLine[] | null> {
  try {
    const tracks = await captionTracks(videoId);
    if (!tracks) return null;

    const track = pickCaptionTrack(tracks, output);
    if (!track) return null;
    const url = new URL(track.baseUrl);
    if (url.hostname !== "www.youtube.com") return null;
    url.searchParams.set("fmt", "json3");
    const captions = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!captions.ok) {
      console.error("[captions] caption request failed:", captions.status);
      return null;
    }
    const lines = parseJson3((await captions.json()) as Json3);
    return lines.length > 0 ? lines : null;
  } catch (error) {
    console.error("[captions] fetch failed:", error instanceof Error ? error.name : "unknown");
    return null;
  }
}
