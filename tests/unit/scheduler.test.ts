import { describe, expect, it } from "vitest";

import { formatInterval, newCard, preview, review, stateName } from "@/features/revision/scheduler";

const now = new Date("2026-11-13T10:00:00.000Z");
const DAY = 86_400_000;

describe("newCard", () => {
  it("is first due one day after saving", async () => {
    const card = await newCard(now);
    expect(card.dueAt).toBe(new Date(now.getTime() + DAY).toISOString());
    expect(stateName(card)).toBe("new");
    expect(card.reps).toBe(0);
  });
});

describe("preview", () => {
  it("shows a growing interval from Again to Easy", async () => {
    const card = await newCard(now);
    const due = new Date(card.dueAt);
    const intervals = await preview(card, due);
    expect(Object.keys(intervals)).toEqual(["again", "hard", "good", "easy"]);
    expect(intervals.again).toMatch(/m$/);
    const toMs = (s: string) => {
      const n = Number.parseFloat(s);
      return s.endsWith("mo") ? n * 30 * DAY : s.endsWith("m") ? n * 60_000 : s.endsWith("h") ? n * 3_600_000 : s.endsWith("d") ? n * DAY : n * 365 * DAY;
    };
    const ms = ["again", "hard", "good", "easy"].map((r) => toMs(intervals[r as keyof typeof intervals]));
    expect([...ms].sort((a, b) => a - b)).toEqual(ms);
  });
});

describe("review", () => {
  it("survives a JSON round trip and advances the card", async () => {
    const card = JSON.parse(JSON.stringify(await newCard(now)));
    const due = new Date(card.dueAt);
    const first = await review(card, "good", due);
    expect(first.card.reps).toBe(1);
    expect(new Date(first.card.dueAt).getTime()).toBeGreaterThan(due.getTime());
    expect(first.log.rating).toBe(3);

    const stored = JSON.parse(JSON.stringify(first.card));
    const second = await review(stored, "again", new Date(first.card.dueAt));
    expect(second.card.lapses).toBe(1);
    expect(stateName(second.card)).toBe("relearning");
  });

  it("is deterministic (no fuzz)", async () => {
    const card = await newCard(now);
    const a = await review(card, "easy", now);
    const b = await review(card, "easy", now);
    expect(a.card.dueAt).toBe(b.card.dueAt);
  });
});

describe("formatInterval", () => {
  it("formats minutes, hours, days, months and years", () => {
    expect(formatInterval(30_000)).toBe("1m");
    expect(formatInterval(10 * 60_000)).toBe("10m");
    expect(formatInterval(6 * 3_600_000)).toBe("6h");
    expect(formatInterval(3 * DAY)).toBe("3d");
    expect(formatInterval(60 * DAY)).toBe("2mo");
    expect(formatInterval(730 * DAY)).toBe("2y");
  });
});
