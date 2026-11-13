/**
 * Human labels for the tutor's context chips (Section 5.6.4): "Using: video 11:11–13:01 ·
 * lecture index 10:41–13:11 · chapter 4 notes". Pure, unit tested. Unknown sources are dropped.
 */
import type { ContextSource } from "@/types/contracts";

const RANGE = /^(video_clip|lecture_index|transcript):(.+)-(.+)$/;
const RANGE_LABEL = { video_clip: "video", lecture_index: "lecture index", transcript: "transcript" } as const;

export function contextSourceLabel(source: ContextSource | string): string | null {
  const range = RANGE.exec(source);
  if (range) return `${RANGE_LABEL[range[1] as keyof typeof RANGE_LABEL]} ${range[2]}–${range[3]}`;
  const notes = /^chapter_notes:(\d+)$/.exec(source);
  if (notes) return `chapter ${notes[1]} notes`;
  if (source === "general_knowledge") return "general knowledge";
  if (source === "whole_lecture") return "whole lecture (AI navigated the video)";
  if (source === "lite_model") return "backup model";
  return null;
}

/** "Using: video 11:11–13:01 · chapter 4 notes", or null when nothing is known. */
export function contextSourcesLine(sources: readonly string[]): string | null {
  const labels = sources.map(contextSourceLabel).filter((l): l is string => l !== null);
  if (labels.length === 0) return null;
  if (labels.length === 1 && labels[0] === "general knowledge") return "General knowledge · no lecture material for this moment";
  return `Using: ${labels.join(" · ")}`;
}
