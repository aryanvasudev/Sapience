/**
 * Basic flashcards without AI (pure): one per key term, with the first sentence of the chapter's
 * notes that uses the term as the answer, plus one per formula.
 */
import type { ChapterPublic, Flashcard } from "@/types/contracts";

/** Markdown → plain sentences, keeping $…$ maths intact. */
export function sentences(markdown: string): string[] {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s.*$/gm, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ");
  return plain
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.length <= 400);
}

export function basicCards(chapter: ChapterPublic): Flashcard[] {
  const notes = sentences(chapter.notesMarkdown ?? "");
  const firstMoment = chapter.keyMoments[0]?.seconds ?? chapter.startSeconds;
  const cards: Flashcard[] = [];
  for (const term of chapter.keyTerms.slice(0, 10)) {
    const needle = term.toLowerCase();
    const back = notes.find((s) => s.toLowerCase().includes(needle)) ?? chapter.summary;
    if (!back) continue;
    const moment = chapter.keyMoments.find((m) => m.label.toLowerCase().includes(needle));
    cards.push({ front: term, back, kind: "term", seconds: moment?.seconds ?? firstMoment });
  }
  for (const formula of chapter.formulas.slice(0, 4)) {
    cards.push({ front: `A formula from “${chapter.title}”`, back: formula.includes("$") ? formula : `$${formula}$`, kind: "formula", seconds: firstMoment });
  }
  if (cards.length === 0 && chapter.summary) {
    cards.push({ front: `What is “${chapter.title}” about?`, back: chapter.summary, kind: "concept", seconds: chapter.startSeconds });
  }
  return cards;
}
