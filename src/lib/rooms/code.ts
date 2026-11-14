/**
 * Study room codes (client-safe). Six characters from an alphabet without look-alikes
 * (no 0/O, 1/I/L), matching `study_rooms_code_format` and `new_room_code()` in the migration.
 */

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
const CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/;

/** "k7q-4mx " → "K7Q4MX". Doesn't validate; see `isRoomCode`. */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isRoomCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

/** "K7Q4MX" → "K7Q 4MX", for reading aloud and display. */
export function formatRoomCode(code: string): string {
  return code.length === ROOM_CODE_LENGTH ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/** The path a QR code or invite link points at. */
export function joinPath(code: string): string {
  return `/app/rooms/join?code=${encodeURIComponent(code)}`;
}

/**
 * A scanned QR payload or pasted text → a room code, or null. Accepts a join link (any host,
 * so a QR made on another deployment still reads), or a bare code with optional separators.
 */
export function codeFromScan(payload: string): string | null {
  const text = payload.trim();
  if (!text || text.length > 2048) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) || text.startsWith("/")) {
    try {
      const url = new URL(text, "https://placeholder.invalid");
      if (!url.pathname.replace(/\/$/, "").endsWith("/rooms/join")) return null;
      const code = normalizeRoomCode(url.searchParams.get("code") ?? "");
      return isRoomCode(code) ? code : null;
    } catch {
      return null;
    }
  }
  if (text.length > 16) return null;
  const code = normalizeRoomCode(text);
  return isRoomCode(code) ? code : null;
}

/** Initials for an avatar: "Priya Sharma" → "PS", "rahul" → "RA". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return (words[0] ?? "?").slice(0, 2).toUpperCase();
  return `${words[0]?.[0] ?? ""}${words[words.length - 1]?.[0] ?? ""}`.toUpperCase();
}
