import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { fromBytea, openSecret, sealSecret, toBytea } from "@/lib/crypto/byok";

const KEY = randomBytes(32).toString("base64");
const SECRET = "AIzaSyExample-not-a-real-key-1234";

describe("BYOK encryption", () => {
  it("round-trips, and the ciphertext never contains the plaintext", () => {
    const sealed = sealSecret(SECRET, KEY);
    expect(sealed.ciphertext.toString("utf8")).not.toContain(SECRET);
    expect(sealed.ciphertext.equals(Buffer.from(SECRET))).toBe(false);
    expect(openSecret(sealed, KEY)).toBe(SECRET);
  });

  it("uses a fresh IV every time", () => {
    const a = sealSecret(SECRET, KEY);
    const b = sealSecret(SECRET, KEY);
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it("rejects a wrong master key and tampered data", () => {
    const sealed = sealSecret(SECRET, KEY);
    expect(() => openSecret(sealed, randomBytes(32).toString("base64"))).toThrow();
    const tampered = Buffer.from(sealed.ciphertext);
    tampered[0] ^= 1;
    expect(() => openSecret({ ciphertext: tampered, iv: sealed.iv }, KEY)).toThrow();
    expect(() => sealSecret(SECRET, randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });

  it("converts to and from PostgREST bytea hex", () => {
    const buf = randomBytes(20);
    expect(toBytea(buf)).toBe(String.raw`\x` + buf.toString("hex"));
    expect(fromBytea(toBytea(buf)).equals(buf)).toBe(true);
    expect(() => fromBytea("abc")).toThrow();
  });
});
