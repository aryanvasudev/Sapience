/**
 * Pure helpers for study-room progress (client-safe): how far a classmate got, whether a goal
 * counts as done, the short peer summary under the player, and the room's activity feed.
 */

/** A lecture goal counts as done once 90% has been played (or the member ticked it). */
export const LECTURE_DONE_FRACTION = 0.9;
/** "Studying now": progress saved within the last two minutes (the player saves every 15 s). */
export const ACTIVE_WINDOW_MS = 2 * 60_000;

export function watchedFraction(furthestSeconds: number, durationSeconds: number | null | undefined): number {
  if (!durationSeconds || durationSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, furthestSeconds / durationSeconds));
}

export function lectureDone(furthestSeconds: number, durationSeconds: number | null | undefined): boolean {
  return watchedFraction(furthestSeconds, durationSeconds) >= LECTURE_DONE_FRACTION;
}

export function isActive(updatedAt: string | null | undefined, now: number): boolean {
  if (!updatedAt) return false;
  const age = now - new Date(updatedAt).getTime();
  return age >= 0 && age < ACTIVE_WINDOW_MS;
}

/** Chapters whose end has been reached. A 5-second grace covers a chapter's last frames. */
export function chaptersCompleted(furthestSeconds: number, chapters: { endSeconds: number }[]): number {
  return chapters.filter((c) => furthestSeconds >= c.endSeconds - 5).length;
}

export type PeerLike = { displayName: string; furthestSeconds: number; lastPositionSeconds: number; updatedAt: string };

/**
 * One line for the strip under the player: names the most relevant two classmates (watching now
 * first, then whoever got furthest), or counts them when there are many.
 */
export function peerSummary(
  peers: PeerLike[],
  durationSeconds: number,
  now: number,
  formatTime: (seconds: number) => string,
): string {
  if (peers.length === 0) return "";
  const ranked = [...peers].sort(
    (a, b) => Number(isActive(b.updatedAt, now)) - Number(isActive(a.updatedAt, now)) || b.furthestSeconds - a.furthestSeconds,
  );
  const phrase = (p: PeerLike) => {
    const first = p.displayName.split(/\s+/)[0] || p.displayName;
    if (lectureDone(p.furthestSeconds, durationSeconds)) return `${first} finished`;
    if (isActive(p.updatedAt, now)) return `${first} is at ${formatTime(p.lastPositionSeconds)}`;
    return p.furthestSeconds > 0 ? `${first} got to ${formatTime(p.furthestSeconds)}` : `${first} opened it`;
  };
  if (peers.length > 3) {
    const finished = peers.filter((p) => lectureDone(p.furthestSeconds, durationSeconds)).length;
    return `${peers.length} classmates on this lecture${finished > 0 ? ` · ${finished} finished` : ""}`;
  }
  return ranked.slice(0, 2).map(phrase).join(" · ") + (peers.length === 3 ? " · +1" : "");
}

export type ActivityItem =
  | { kind: "joined"; at: string; userId: string; name: string }
  | { kind: "goal_added"; at: string; userId: string | null; name: string; goalTitle: string }
  | { kind: "goal_done"; at: string; userId: string; name: string; goalTitle: string };

/** Joins, new goals and ticks, newest first. Members who left are shown as "Someone". */
export function buildActivity(input: {
  members: { userId: string; displayName: string; joinedAt: string }[];
  goals: { title: string; createdBy: string | null; createdAt: string; checks: { userId: string; doneAt: string }[] }[];
  limit?: number;
}): ActivityItem[] {
  const names = new Map(input.members.map((m) => [m.userId, m.displayName]));
  const nameOf = (id: string | null) => (id && names.get(id)) || "Someone";
  const items: ActivityItem[] = [
    ...input.members.map((m): ActivityItem => ({ kind: "joined", at: m.joinedAt, userId: m.userId, name: m.displayName })),
    ...input.goals.flatMap((g): ActivityItem[] => [
      { kind: "goal_added", at: g.createdAt, userId: g.createdBy, name: nameOf(g.createdBy), goalTitle: g.title },
      ...g.checks.map((c): ActivityItem => ({ kind: "goal_done", at: c.doneAt, userId: c.userId, name: nameOf(c.userId), goalTitle: g.title })),
    ]),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, input.limit ?? 30);
}

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", or a date. */
export function timeAgo(at: string, now: number): string {
  const ms = Math.max(0, now - new Date(at).getTime());
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
