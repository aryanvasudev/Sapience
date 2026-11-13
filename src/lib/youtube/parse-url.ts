/**
 * Parse a pasted YouTube link (Section 5.1). Pure; runs on the client (instant feedback) and the
 * server (authoritative check).
 */

export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export type ParsedYouTubeUrl = { videoId: string; startSeconds: number | null };

const WATCH_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);
const NOCOOKIE_HOSTS = new Set(["youtube-nocookie.com", "www.youtube-nocookie.com"]);
const PATH_PREFIXES = ["embed", "shorts", "live", "v"];

export function isVideoId(value: string): boolean {
  return VIDEO_ID_PATTERN.test(value);
}

/** Returns null for anything that isn't a link to a single YouTube video. */
export function parseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  const raw = input.trim();
  if (!raw || raw.length > 2048) return null;

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  let candidate: string | undefined;

  if (host === "youtu.be") {
    candidate = segments[0];
  } else if (WATCH_HOSTS.has(host)) {
    if (segments[0] === "watch") candidate = url.searchParams.get("v") ?? undefined;
    else if (segments.length >= 2 && PATH_PREFIXES.includes(segments[0])) candidate = segments[1];
  } else if (NOCOOKIE_HOSTS.has(host)) {
    if (segments[0] === "embed") candidate = segments[1];
  } else {
    return null;
  }

  if (!candidate || !isVideoId(candidate)) return null;

  const t = url.searchParams.get("t") ?? url.searchParams.get("start") ?? hashTime(url.hash);
  return { videoId: candidate, startSeconds: t === null ? null : parseStartTime(t) };
}

function hashTime(hash: string): string | null {
  const match = /^#t=(.+)$/.exec(hash);
  return match ? match[1] : null;
}

/** `90`, `90s`, `1m30s`, `1h2m3s` → seconds. Anything else → null. */
export function parseStartTime(value: string): number | null {
  const v = value.trim().toLowerCase();
  if (/^\d+$/.test(v)) return Number(v);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(v);
  if (!match || (!match[1] && !match[2] && !match[3])) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}
