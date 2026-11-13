/**
 * ISO 8601 duration (as returned by YouTube `contentDetails.duration`, e.g. `PT1H2M3S`,
 * `P1DT2H`) → seconds. Returns null for anything unparseable. Years and months aren't used by
 * YouTube and are rejected.
 */
export function parseIsoDuration(value: string): number | null {
  const match = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value.trim());
  if (!match) return null;
  const [, w, d, h, m, s] = match;
  if (![w, d, h, m, s].some(Boolean)) return null;
  if (value.endsWith("T")) return null;
  return (
    Number(w ?? 0) * 604800 +
    Number(d ?? 0) * 86400 +
    Number(h ?? 0) * 3600 +
    Number(m ?? 0) * 60 +
    Math.floor(Number(s ?? 0))
  );
}
