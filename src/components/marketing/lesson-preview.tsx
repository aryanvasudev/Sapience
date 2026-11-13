import katex from "katex";

import { LessonPreviewMotion } from "./lesson-preview-motion";

/**
 * Landing-page product preview: what a Sapience lesson looks like at the moment a checkpoint
 * pauses the video. Example content, labelled as such, built in code (no screenshot, no fake
 * YouTube UI). The board formula is rendered with KaTeX on the server, as in real notes.
 */
export function LessonPreview() {
  const formula = katex.renderToString(String.raw`\mathrm{DP} = \dfrac{M_n}{M_0}`, {
    throwOnError: false,
    displayMode: true,
    output: "html",
  });
  const working = katex.renderToString(String.raw`\dfrac{28\,000}{28} = 1\,000`, {
    throwOnError: false,
    displayMode: true,
    output: "html",
  });

  return <LessonPreviewMotion formulaHtml={formula} workingHtml={working} />;
}
