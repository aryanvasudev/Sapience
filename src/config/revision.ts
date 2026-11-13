/**
 * Revision scheduling settings (Section 5.10). ts-fsrs v6 `DefaultScheduler` (FSRS-7 by default).
 * No fuzz, so the interval shown on a button is exactly what the student gets.
 */
export const REVISION_SCHEDULER_OPTIONS = {
  version: "FSRS-7",
  desiredRetention: 0.9,
  enableFuzz: false,
  maximumInterval: 365,
} as const;

/** A newly saved concept is first due a day later, so saving never creates an instant review. */
export const FIRST_REVIEW_DELAY_MS = 24 * 60 * 60 * 1000;
