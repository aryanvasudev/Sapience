import { describe, expect, it } from "vitest";

import { codeFromScan, formatRoomCode, initials, isRoomCode, joinPath, normalizeRoomCode, ROOM_CODE_ALPHABET } from "@/lib/rooms/code";

describe("room codes", () => {
  it("normalizes case and separators", () => {
    expect(normalizeRoomCode(" k7q-4mx ")).toBe("K7Q4MX");
    expect(normalizeRoomCode("k7q 4mx")).toBe("K7Q4MX");
  });

  it("accepts only the look-alike-free alphabet", () => {
    expect(isRoomCode("K7Q4MX")).toBe(true);
    expect(isRoomCode("K7Q4M")).toBe(false);
    expect(isRoomCode("K7Q4M0")).toBe(false); // zero
    expect(isRoomCode("K7Q4MO")).toBe(false); // letter O
    expect(isRoomCode("K7Q4MI")).toBe(false);
    expect(isRoomCode("K7Q4ML")).toBe(false);
    expect(isRoomCode("K7Q4M1")).toBe(false);
    for (const ch of ROOM_CODE_ALPHABET) expect(isRoomCode(ch.repeat(6))).toBe(true);
  });

  it("formats for reading", () => {
    expect(formatRoomCode("K7Q4MX")).toBe("K7Q 4MX");
  });

  it("builds the join path", () => {
    expect(joinPath("K7Q4MX")).toBe("/app/rooms/join?code=K7Q4MX");
  });
});

describe("codeFromScan", () => {
  it("reads a join link from any host", () => {
    expect(codeFromScan("https://sapience.app/app/rooms/join?code=K7Q4MX")).toBe("K7Q4MX");
    expect(codeFromScan("http://localhost:3000/app/rooms/join?code=k7q4mx")).toBe("K7Q4MX");
    expect(codeFromScan("/app/rooms/join?code=K7Q4MX")).toBe("K7Q4MX");
  });

  it("reads a bare code", () => {
    expect(codeFromScan("k7q-4mx")).toBe("K7Q4MX");
  });

  it("rejects other links and junk", () => {
    expect(codeFromScan("https://example.com/?code=K7Q4MX")).toBeNull();
    expect(codeFromScan("https://sapience.app/app/rooms/join?code=nope")).toBeNull();
    expect(codeFromScan("hello world this is long")).toBeNull();
    expect(codeFromScan("")).toBeNull();
  });
});

describe("initials", () => {
  it("uses first and last word", () => {
    expect(initials("Priya Sharma")).toBe("PS");
    expect(initials("rahul")).toBe("RA");
    expect(initials("  ")).toBe("?");
  });
});
