import { describe, expect, it } from "vitest";

import { formatDue } from "@/lib/format";

const NOW = Date.parse("2026-11-13T10:00:00Z");
const at = (ms: number) => new Date(NOW + ms).toISOString();
const DAY = 86_400_000;

describe("formatDue", () => {
  it("handles unscheduled and overdue items", () => {
    expect(formatDue(null, NOW)).toBe("Not scheduled");
    expect(formatDue(at(-1), NOW)).toBe("Due now");
    expect(formatDue(at(0), NOW)).toBe("Due now");
  });

  it("rounds to whole days", () => {
    expect(formatDue(at(3 * 3_600_000), NOW)).toBe("Due later today");
    expect(formatDue(at(DAY), NOW)).toBe("Due tomorrow");
    expect(formatDue(at(1.4 * DAY), NOW)).toBe("Due tomorrow");
    expect(formatDue(at(5 * DAY), NOW)).toBe("Due in 5 days");
  });
});
