import { describe, expect, it } from "vitest";

import { fixEscapedNewlines } from "@/lib/lessons/public-serializer";

describe("fixEscapedNewlines", () => {
  it("turns literal \n into line breaks in notes without real ones", () => {
    expect(fixEscapedNewlines("## Recap\n- Input: 784 neurons\n- Output: 10\n\n## Next")).toBe("## Recap\n- Input: 784 neurons\n- Output: 10\n\n## Next");
  });

  it("keeps LaTeX commands that start with \n", () => {
    expect(fixEscapedNewlines("Gradient $\nabla C$ and $a \neq b$\n- next")).toBe("Gradient $\nabla C$ and $a \neq b$\n- next");
  });

  it("leaves notes with real line breaks alone", () => {
    const notes = "## Title\n- uses \n in code";
    expect(fixEscapedNewlines(notes)).toBe(notes);
  });
});

describe("fixEscapedNewlines: notes written on one line", () => {
  it("puts headings and bullets back on their own lines", () => {
    const flat =
      "### Problem setup: Monkey postpones it. Key points: - Monkey checks his resolutions. - Every Monday, he postpones it. ### Returning when motivation fades. Key points: - Keep using the same cue.";
    expect(fixEscapedNewlines(flat)).toBe(
      "### Problem setup: Monkey postpones it.\n\nKey points:\n\n- Monkey checks his resolutions.\n- Every Monday, he postpones it.\n\n### Returning when motivation fades.\n\nKey points:\n\n- Keep using the same cue.",
    );
  });

  it("leaves a plain one-line paragraph alone", () => {
    expect(fixEscapedNewlines("Energy-mass equivalence is simple.")).toBe("Energy-mass equivalence is simple.");
  });
});
