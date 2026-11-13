/**
 * Group outline chapters into `chapters` jobs (Section 5.4). Pure, unit tested.
 * A batch covers at most `maxSeconds` of video and never splits a chapter; a single chapter
 * longer than the limit gets a batch of its own. At most 12 chapters per batch (ChapterBatch).
 */
export type BatchableChapter = { position: number; startSeconds: number; endSeconds: number };
export type ChapterBatchPlan = { positions: number[]; startSeconds: number; endSeconds: number };

const MAX_CHAPTERS_PER_BATCH = 12;

export function batchChapters(chapters: BatchableChapter[], maxSeconds: number): ChapterBatchPlan[] {
  const sorted = [...chapters].sort((a, b) => a.startSeconds - b.startSeconds);
  const batches: ChapterBatchPlan[] = [];
  let current: ChapterBatchPlan | null = null;

  for (const chapter of sorted) {
    const fits =
      current !== null &&
      chapter.endSeconds - current.startSeconds <= maxSeconds &&
      current.positions.length < MAX_CHAPTERS_PER_BATCH;
    if (fits && current) {
      current.positions.push(chapter.position);
      current.endSeconds = chapter.endSeconds;
    } else {
      current = { positions: [chapter.position], startSeconds: chapter.startSeconds, endSeconds: chapter.endSeconds };
      batches.push(current);
    }
  }
  return batches;
}
