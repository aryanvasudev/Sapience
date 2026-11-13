/**
 * Thin wrapper over ts-fsrs (Section 5.10). Pure apart from the scheduler instance; unit tested.
 *
 * Cards are stored in `revision_items.card` as JSON with ISO date strings and revived here, since
 * ts-fsrs needs real `Date`s. `due_at`, `state`, `reps` and `lapses` are denormalised from the card.
 */
import { DefaultScheduler, Rating, type Grade } from "ts-fsrs";
import { z } from "zod";

import { FIRST_REVIEW_DELAY_MS, REVISION_SCHEDULER_OPTIONS } from "@/config/revision";
import { RECALL_RATINGS, REVISION_STATES, type RecallRating, type RevisionState } from "@/config/enums";

const createScheduler = () => DefaultScheduler({ ...REVISION_SCHEDULER_OPTIONS });
type Scheduler = Awaited<ReturnType<typeof createScheduler>>;
type ReviewInput = Parameters<Scheduler["review"]>[0];
type FsrsCard = ReviewInput["card"];

let schedulerPromise: Promise<Scheduler> | undefined;
function scheduler(): Promise<Scheduler> {
  schedulerPromise ??= createScheduler();
  return schedulerPromise;
}

/** The stored shape: everything ts-fsrs returns, with dates as ISO strings. */
export const StoredCardSchema = z.looseObject({
  dueAt: z.iso.datetime(),
  lastReviewAt: z.iso.datetime().nullable(),
  state: z.number().int().min(0).max(3),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
});
export type StoredCard = z.infer<typeof StoredCardSchema>;

const RATING: Record<RecallRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function toStored(card: unknown): StoredCard {
  return StoredCardSchema.parse(JSON.parse(JSON.stringify(card)));
}

function revive(card: StoredCard): FsrsCard {
  const parsed = StoredCardSchema.parse(card);
  return {
    ...parsed,
    dueAt: new Date(parsed.dueAt),
    lastReviewAt: parsed.lastReviewAt ? new Date(parsed.lastReviewAt) : null,
  } as unknown as FsrsCard;
}

export function stateName(card: StoredCard): RevisionState {
  return REVISION_STATES[card.state] ?? "new";
}

/** A new card, first due one day after saving. */
export async function newCard(now: Date): Promise<StoredCard> {
  const s = await scheduler();
  const card = toStored(s.newCard({ now }));
  return { ...card, dueAt: new Date(now.getTime() + FIRST_REVIEW_DELAY_MS).toISOString() };
}

/** "10m", "6h", "1d", "3d", "2mo", "1y": the next interval if the student picked each rating. */
export function formatInterval(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round((days / 365) * 10) / 10}y`;
}

export async function preview(card: StoredCard, now: Date): Promise<Record<RecallRating, string>> {
  const s = await scheduler();
  const result = {} as Record<RecallRating, string>;
  const revived = revive(card);
  for (const rating of RECALL_RATINGS) {
    const next = s.review({ card: revived, grade: RATING[rating], now });
    result[rating] = formatInterval(new Date(next.card.dueAt).getTime() - now.getTime());
  }
  return result;
}

export async function review(card: StoredCard, rating: RecallRating, now: Date): Promise<{ card: StoredCard; log: Record<string, unknown> }> {
  const s = await scheduler();
  const result = s.review({ card: revive(card), grade: RATING[rating], now });
  return { card: toStored(result.card), log: JSON.parse(JSON.stringify(result.revlog)) as Record<string, unknown> };
}
