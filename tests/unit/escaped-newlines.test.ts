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
