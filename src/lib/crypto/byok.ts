import "server-only";

/**
 * Encryption for students' own AI keys (Section 4.5.4): AES-256-GCM with BYOK_ENCRYPTION_KEY
 * (32 bytes, base64) and a random 12-byte IV per key. The auth tag is appended to the ciphertext.
 * Pure apart from the master key, which is passed in so tests don't need the environment.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;

export type Sealed = { ciphertext: Buffer; iv: Buffer };

function masterKey(base64: string): Buffer {
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) throw new Error("BYOK_ENCRYPTION_KEY must be 32 bytes");
  return key;
}

export function sealSecret(plaintext: string, base64Key: string): Sealed {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", masterKey(base64Key), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext: Buffer.concat([body, cipher.getAuthTag()]), iv };
}

/** Throws if the data was tampered with or the master key is wrong. */
export function openSecret(sealed: Sealed, base64Key: string): string {
  if (sealed.iv.length !== IV_BYTES || sealed.ciphertext.length <= TAG_BYTES) throw new Error("byok: malformed secret");
  const body = sealed.ciphertext.subarray(0, sealed.ciphertext.length - TAG_BYTES);
  const tag = sealed.ciphertext.subarray(sealed.ciphertext.length - TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", masterKey(base64Key), sealed.iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

/** PostgREST reads and writes `bytea` as `\x`-prefixed hex. */
const BYTEA_PREFIX = String.raw`\x`;

export const toBytea = (buf: Buffer): string => `${BYTEA_PREFIX}${buf.toString("hex")}`;

export function fromBytea(value: string): Buffer {
  if (!value.startsWith(BYTEA_PREFIX)) throw new Error("byok: unexpected bytea format");
  return Buffer.from(value.slice(2), "hex");
}
