/**
 * Search the lecture (Section 5.9). Pure, unit tested, used on both sides:
 * - `instantSearch`: the client-side filter over titles, key terms, key moments and the lecture
 *   index. Case- and diacritic-insensitive.
 * - `indexText` / `resolveRefs`: what "Ask search" sends to the model, and the check that every
 *   reference it returns is one we gave it. Unknown refs are discarded; times always come from
 *   our data, never from the model.
 */
import { formatTimestamp } from "@/lib/format";
import type { ChapterPublic } from "@/types/contracts";

export type SearchHit = {
  ref: string;
  kind: "chapter" | "term" | "moment" | "segment";
  seconds: number;
  label: string;
  snippet: string;
};

export type SearchResult = { ref: string; seconds: number; label: string; why: string; snippet: string };

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

const SNIPPET_CHARS = 160;

/** A window of text around the first match, or the start of the text. */
export function snippetAround(text: string, query?: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= SNIPPET_CHARS) return clean;
  const at = query ? normalize(clean).indexOf(normalize(query)) : -1;
  if (at < 0) return `${clean.slice(0, SNIPPET_CHARS - 1).trimEnd()}…`;
  const start = Math.max(0, at - 50);
  const end = Math.min(clean.length, start + SNIPPET_CHARS);
  return `${start > 0 ? "…" : ""}${clean.slice(start, end).trim()}${end < clean.length ? "…" : ""}`;
}

export function instantSearch(chapters: ChapterPublic[], query: string, limit = 20): SearchHit[] {
  const q = normalize(query.trim());
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  const matches = (text: string | null | undefined) => (text ? normalize(text).includes(q) : false);

  for (const c of chapters) {
    const chapterLabel = `${c.position + 1}. ${c.title}`;
    if (matches(c.title)) {
      hits.push({ ref: `c${c.position}`, kind: "chapter", seconds: c.startSeconds, label: chapterLabel, snippet: c.summary ? snippetAround(c.summary) : "" });
    }
    for (const term of c.keyTerms) {
      if (matches(term)) hits.push({ ref: `c${c.position}t:${term}`, kind: "term", seconds: c.startSeconds, label: term, snippet: chapterLabel });
    }
    for (const m of c.keyMoments) {
      if (matches(m.label)) hits.push({ ref: m.id, kind: "moment", seconds: m.seconds, label: m.label, snippet: chapterLabel });
    }
    for (const s of c.segments) {
      const inSpeech = matches(s.speech);
      if (inSpeech || matches(s.board)) {
        hits.push({
          ref: s.id,
          kind: "segment",
          seconds: s.startSeconds,
          label: chapterLabel,
          snippet: snippetAround(inSpeech ? s.speech : (s.board ?? ""), query),
        });
      }
    }
  }
  const order = { chapter: 0, term: 1, moment: 2, segment: 3 } as const;
  return hits.sort((a, b) => order[a.kind] - order[b.kind] || a.seconds - b.seconds).slice(0, limit);
}

/** The lecture index and key moments as text for the model, with their IDs. */
export function indexText(chapters: ChapterPublic[], fence: (s: string) => string): string {
  const lines: string[] = [];
  for (const c of chapters.filter((ch) => ch.status === "ready")) {
    lines.push(`## Chapter ${c.position + 1}: ${fence(c.title)}`);
    for (const m of c.keyMoments) lines.push(`${m.id} [${formatTimestamp(m.seconds)}] key moment: ${fence(m.label)}`);
    for (const s of c.segments) {
      lines.push(`${s.id} [${formatTimestamp(s.startSeconds)}-${formatTimestamp(s.endSeconds)}] said: ${fence(s.speech)}`);
      if (s.board) lines.push(`  board: ${fence(s.board)}`);
    }
  }
  return lines.join("\n");
}

/** Keep only refs we provided, at most `max`, without duplicates; fill times and text from our data. */
export function resolveRefs(chapters: ChapterPublic[], refs: { ref: string; why: string }[], max = 3): SearchResult[] {
  const known = new Map<string, Omit<SearchResult, "why">>();
  for (const c of chapters.filter((ch) => ch.status === "ready")) {
    const label = `${c.position + 1}. ${c.title}`;
    for (const m of c.keyMoments) known.set(m.id, { ref: m.id, seconds: m.seconds, label: m.label, snippet: label });
    for (const s of c.segments) {
      known.set(s.id, { ref: s.id, seconds: s.startSeconds, label, snippet: snippetAround(s.speech || (s.board ?? "")) });
    }
  }
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  for (const { ref, why } of refs) {
    const id = ref.trim();
    const hit = known.get(id);
    if (!hit || seen.has(id)) continue;
    seen.add(id);
    results.push({ ...hit, why: why.trim() });
    if (results.length >= max) break;
  }
  return results;
}
