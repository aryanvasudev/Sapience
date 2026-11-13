/** 75 → "1:15", 3725 → "1:02:05". Negative or non-finite input is treated as 0. */
export function formatTimestamp(totalSeconds: number): string {
  const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${ss}` : `${minutes}:${ss}`;
}

/** 3000 → "50 min", 3725 → "1 h 2 min". */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "Due now", "Due later today", "Due tomorrow", "Due in 5 days". */
export function formatDue(dueAt: string | null, now: number): string {
  if (!dueAt) return "Not scheduled";
  const ms = new Date(dueAt).getTime() - now;
  if (ms <= 0) return "Due now";
  const days = Math.round(ms / 86_400_000);
  if (days < 1) return "Due later today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}
