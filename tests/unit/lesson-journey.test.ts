import { describe, expect, it } from "vitest";

import { lessonJourney, type JourneyInput } from "@/lib/lessons/journey";
import type { ChapterPublic, LessonStatusResponse } from "@/types/contracts";

const chapter = (position: number, status: ChapterPublic["status"], withCheckpoint = true): ChapterPublic => ({
  position,
  status,
  title: `Chapter ${position + 1}`,
  startSeconds: position * 100,
  endSeconds: (position + 1) * 100,
  summary: null,
  notesMarkdown: null,
  keyTerms: [],
  formulas: [],
  keyMoments: [],
  segments: [],
  checkpoint: withCheckpoint && status === "ready"
    ? { id: `00000000-0000-4000-8000-00000000000${position}`, concept: "c", prompt: "p", options: ["a", "b", "c", "d"], atSeconds: null }
    : null,
});

function status(over: Partial<LessonStatusResponse> & { chapters?: ChapterPublic[] } = {}): LessonStatusResponse {
  const { chapters, ...rest } = over;
  const list = chapters ?? [];
  return {
    status: "ready",
    progress: { chaptersReady: list.filter((c) => c.status === "ready").length, chaptersTotal: list.length },
    video: { youtubeVideoId: "FIXTURE0001", title: "T", channelTitle: "C", durationSeconds: 300, thumbnailUrl: null } as LessonStatusResponse["video"],
    lesson: chapters
      ? { youtubeVideoId: "FIXTURE0001", language: "en", source: "gemini_video", status: "ready", spokenLanguage: null, overview: null, chapters: list }
      : undefined,
    attempts: {},
    capabilities: { videoLessons: true, videoClipping: false, tutorClip: false, agenticVideo: false },
    waitingForCapacity: false,
    ...rest,
  };
}

const input = (over: Partial<JourneyInput> = {}): JourneyInput => ({
  data: status({ chapters: [chapter(0, "ready"), chapter(1, "ready"), chapter(2, "ready")] }),
  stalled: false,
  furthestSeconds: 0,
  ended: false,
  playing: false,
  checkpointsAnswered: 0,
  recapSeen: false,
  checkpointOpen: null,
  currentChapter: null,
  ...over,
});

const states = (j: ReturnType<typeof lessonJourney>) => Object.fromEntries(j.steps.map((s) => [s.id, s.state]));

describe("lessonJourney", () => {
  it("shows the queue, and capacity waits as waiting rather than failure", () => {
    const queued = lessonJourney(input({ data: status({ status: "queued", waitingForCapacity: true }) }));
    expect(states(queued)).toMatchObject({ video: "done", analysis: "active", notes: "upcoming", watch: "upcoming" });
    expect(queued.tone).toBe("waiting");
    expect(queued.headline).toMatch(/free AI capacity/);
    expect(queued.steps[1]?.fraction).toBeNull();
  });

  it("says the AI is watching before the outline exists", () => {
    const j = lessonJourney(input({ data: status({ status: "outlining" }) }));
    expect(j.tone).toBe("working");
    expect(j.headline).toBe("AI is watching the lecture…");
  });

  it("counts chapters while notes are written, and lets the student watch meanwhile", () => {
    const data = status({ status: "building", chapters: [chapter(0, "ready"), chapter(1, "pending"), chapter(2, "pending")] });
    const j = lessonJourney(input({ data, playing: true, furthestSeconds: 30, currentChapter: { position: 0, title: "Chapter 1" } }));
    expect(states(j)).toMatchObject({ analysis: "done", notes: "active", watch: "active" });
    expect(j.steps[2]?.detail).toBe("1/3");
    expect(j.headline).toBe("Writing notes: 1 of 3 chapters ready");
  });

  it("reports a build that never got an outline as failed", () => {
    const j = lessonJourney(input({ data: status({ status: "failed" }) }));
    expect(states(j)).toMatchObject({ analysis: "failed", notes: "failed" });
    expect(j.tone).toBe("failed");
  });

  it("flags failed chapters once the rest are built", () => {
    const data = status({ chapters: [chapter(0, "ready"), chapter(1, "failed"), chapter(2, "ready")] });
    const j = lessonJourney(input({ data }));
    expect(states(j).notes).toBe("failed");
    expect(j.headline).toBe("1 chapter didn't build.");
  });

  it("follows the student through watching, checkpoints and the recap", () => {
    const fresh = lessonJourney(input());
    expect(fresh.headline).toBe("Your lesson is ready.");

    const watching = lessonJourney(input({ playing: true, furthestSeconds: 150, checkpointsAnswered: 1, currentChapter: { position: 1, title: "Chapter 2" } }));
    expect(states(watching)).toMatchObject({ watch: "active", checkpoints: "active", recap: "upcoming" });
    expect(watching.steps[3]?.detail).toBe("50%");
    expect(watching.headline).toBe("Watching chapter 2: Chapter 2");

    const checkpoint = lessonJourney(input({ checkpointOpen: 2, furthestSeconds: 300 }));
    expect(checkpoint.headline).toBe("Checkpoint for chapter 3");

    const end = lessonJourney(input({ ended: true, furthestSeconds: 300, checkpointsAnswered: 3 }));
    expect(states(end)).toMatchObject({ watch: "done", checkpoints: "done", recap: "active" });
    expect(end.headline).toBe("You've reached the end.");

    const done = lessonJourney(input({ ended: true, furthestSeconds: 300, checkpointsAnswered: 3, recapSeen: true }));
    expect(done.steps.every((s) => s.state === "done")).toBe(true);
    expect(done.overall).toBe(1);
    expect(done.tone).toBe("done");
  });

  it("resumes from the furthest point watched", () => {
    const j = lessonJourney(input({ furthestSeconds: 90 }));
    expect(j.headline).toBe("Pick up where you left off.");
    expect(j.hint).toMatch(/^30% watched, up to 1:30/);
  });
});
