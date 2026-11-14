import { describe, expect, it } from "vitest";

import { formatTimestamp } from "@/lib/format";
import { buildActivity, chaptersCompleted, isActive, lectureDone, peerSummary, timeAgo, watchedFraction } from "@/lib/rooms/progress";

const NOW = Date.parse("2026-11-13T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("progress", () => {
  it("clamps the watched fraction and needs a duration", () => {
    expect(watchedFraction(300, 600)).toBe(0.5);
    expect(watchedFraction(900, 600)).toBe(1);
    expect(watchedFraction(300, null)).toBe(0);
  });

  it("counts a lecture done at 90%", () => {
    expect(lectureDone(539, 600)).toBe(false);
    expect(lectureDone(540, 600)).toBe(true);
  });

  it("is active within two minutes", () => {
    expect(isActive(ago(60_000), NOW)).toBe(true);
    expect(isActive(ago(3 * 60_000), NOW)).toBe(false);
    expect(isActive(null, NOW)).toBe(false);
  });

  it("counts completed chapters with a small grace", () => {
    const chapters = [{ endSeconds: 100 }, { endSeconds: 200 }, { endSeconds: 300 }];
    expect(chaptersCompleted(0, chapters)).toBe(0);
    expect(chaptersCompleted(196, chapters)).toBe(2);
    expect(chaptersCompleted(300, chapters)).toBe(3);
  });
});

describe("peerSummary", () => {
  const peer = (displayName: string, furthestSeconds: number, updatedMsAgo: number, lastPositionSeconds = furthestSeconds) => ({
    displayName,
    furthestSeconds,
    lastPositionSeconds,
    updatedAt: ago(updatedMsAgo),
  });

  it("puts whoever is watching now first", () => {
    const text = peerSummary([peer("Rahul Kumar", 590, 3_600_000), peer("Priya", 760, 10_000)], 1000, NOW, formatTimestamp);
    expect(text).toBe("Priya is at 12:40 · Rahul got to 9:50");
  });

  it("says who finished", () => {
    expect(peerSummary([peer("Rahul", 950, 3_600_000)], 1000, NOW, formatTimestamp)).toBe("Rahul finished");
  });

  it("counts large groups", () => {
    const peers = [peer("A", 10, 1e7), peer("B", 990, 1e7), peer("C", 10, 1e7), peer("D", 10, 1e7)];
    expect(peerSummary(peers, 1000, NOW, formatTimestamp)).toBe("4 classmates on this lecture · 1 finished");
  });

  it("is empty with no peers", () => {
    expect(peerSummary([], 1000, NOW, formatTimestamp)).toBe("");
  });
});

describe("buildActivity", () => {
  it("merges joins, goals and ticks newest first", () => {
    const items = buildActivity({
      members: [
        { userId: "u1", displayName: "Priya", joinedAt: ago(5000) },
        { userId: "u2", displayName: "Rahul", joinedAt: ago(4000) },
      ],
      goals: [{ title: "Watch lecture 3", createdBy: "u1", createdAt: ago(3000), checks: [{ userId: "u2", doneAt: ago(1000) }] }],
    });
    expect(items.map((i) => i.kind)).toEqual(["goal_done", "goal_added", "joined", "joined"]);
    expect(items[0]).toMatchObject({ name: "Rahul", goalTitle: "Watch lecture 3" });
  });

  it("names members who left Someone", () => {
    const [item] = buildActivity({ members: [], goals: [{ title: "G", createdBy: "gone", createdAt: ago(1), checks: [] }] });
    expect(item).toMatchObject({ kind: "goal_added", name: "Someone" });
  });
});

describe("timeAgo", () => {
  it("reads naturally", () => {
    expect(timeAgo(ago(10_000), NOW)).toBe("just now");
    expect(timeAgo(ago(5 * 60_000), NOW)).toBe("5 min ago");
    expect(timeAgo(ago(3 * 3_600_000), NOW)).toBe("3 h ago");
    expect(timeAgo(ago(30 * 3_600_000), NOW)).toBe("yesterday");
  });
});
