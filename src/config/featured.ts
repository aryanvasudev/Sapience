import type { OutputLanguage } from "@/config/enums";

/**
 * Featured lessons on the dashboard (Section 5.12): pre-built lectures that open instantly and
 * never count against the daily lesson limit (opening an existing lesson is free).
 *
 * Only lessons that are actually `ready` are shown, so an entry here is safe to add before its
 * lesson is built: pre-generate it by opening the lecture once in that language. Keep this list
 * to real, public, embeddable lectures.
 */
export const FEATURED_LESSONS: readonly { videoId: string; language: OutputLanguage }[] = [];
