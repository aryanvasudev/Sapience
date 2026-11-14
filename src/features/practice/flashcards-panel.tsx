"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";

import {
  ArrowBackIcon,
  ArrowForwardIcon,
  CardsStarIcon,
  CheckIcon,
  FlipIcon,
  PlayArrowIcon,
  ProgressActivityIcon,
  RefreshIcon,
  ReplayIcon,
  UndoIcon,
} from "@/components/icons";
import { Markdown } from "@/components/shared/markdown";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import type { OutputLanguage } from "@/config/enums";
import { SaveConceptButton } from "@/features/revision/components/save-concept-button";
import { requestJson } from "@/lib/client-api";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FlashcardsResponseSchema, type ChapterPublic, type Flashcard } from "@/types/contracts";

type Card = Flashcard & { id: string; chapterPosition: number; chapterTitle: string };
type Mark = "know" | "learning";

const KIND_LABEL: Record<Flashcard["kind"], string> = { term: "Term", concept: "Concept", why: "Why", formula: "Formula" };
const EASE = [0.22, 1, 0.36, 1] as const;

/** A sorted card leaves toward its pile: right for "know it", left for "still learning". */
const CARD_VARIANTS = {
  enter: { opacity: 0, y: 10, scale: 0.98 },
  center: { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, transition: { duration: 0.28, ease: EASE } },
  exit: (m: Mark) => ({ opacity: 0, x: m === "know" ? 90 : -90, rotate: m === "know" ? 5 : -5, transition: { duration: 0.22, ease: EASE } }),
};
const REDUCED_VARIANTS = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/**
 * Flashcards for a chapter or the whole lecture. Flip with Space, sort with ← (still learning) and
 * → (know it). Cards you're still learning come back in a second round, and any card can go to
 * spaced revision or jump to where the lecture teaches it.
 */
export function FlashcardsPanel({
  videoId,
  language,
  chapters,
  currentPosition,
  onSeek,
}: {
  videoId: string;
  language: OutputLanguage;
  chapters: ChapterPublic[];
  currentPosition: number | null;
  onSeek: (seconds: number) => void;
}) {
  const ready = chapters.filter((c) => c.status === "ready");
  const current = ready.find((c) => c.position === currentPosition) ?? ready[0] ?? null;
  const [scope, setScope] = useState<number | "all" | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [basic, setBasic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (next: number | "all") => {
    setScope(next);
    setLoading(true);
    setError(null);
    const r = await requestJson(`/api/lessons/${videoId}/flashcards`, FlashcardsResponseSchema, {
      body: { language, ...(next === "all" ? {} : { chapterPosition: next }) },
    });
    setLoading(false);
    if (!r.ok) {
      setError(r.message);
      setScope(null);
      return;
    }
    setBasic(r.data.decks.some((d) => d.basic));
    setCards(
      r.data.decks.flatMap((d) =>
        d.cards.map((c, i) => ({ ...c, id: `${d.chapterPosition}-${i}`, chapterPosition: d.chapterPosition, chapterTitle: d.title })),
      ),
    );
  };

  if (ready.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-5 text-sm leading-relaxed text-muted-foreground">
        Flashcards are made once the first chapter&apos;s notes are ready.
      </p>
    );
  }

  if (loading) {
    return (
      <div role="status" className="flex aspect-[5/4] items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground">
        <ProgressActivityIcon className="size-4.5 animate-spin motion-reduce:animate-none" />
        {scope === "all" ? "Making cards for the whole lecture…" : "Making cards for this chapter…"}
      </div>
    );
  }

  if (!cards || scope === null) {
    const option =
      "group/opt grid w-full gap-1 rounded-[14px] border bg-card p-4 text-left transition-[border-color,background-color,transform] duration-150 ease-(--ease-out) active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [@media(hover:hover)]:hover:border-foreground/20 [@media(hover:hover)]:hover:bg-raised";
    return (
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <h3 className="flex items-center gap-2 text-[0.9375rem] font-medium">
            <CardsStarIcon className="size-4.5 text-brand" />
            Flashcards
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Key terms, ideas and formulas from the lecture. Sort what you know from what you&apos;re still learning; the second
            pile comes back.
          </p>
        </div>
        <div className="grid gap-2">
          {current ? (
            <button type="button" className={option} onClick={() => void load(current.position)}>
              <span className="flex items-center justify-between gap-3 text-sm font-medium">
                This chapter
                <ArrowForwardIcon className="size-4 text-faint" />
              </span>
              <span className="truncate text-[0.8125rem] text-muted-foreground">
                {current.position + 1}. {current.title}
              </span>
            </button>
          ) : null}
          <button type="button" className={option} onClick={() => void load("all")}>
            <span className="flex items-center justify-between gap-3 text-sm font-medium">
              Whole lecture
              <ArrowForwardIcon className="size-4 text-faint" />
            </span>
            <span className="text-[0.8125rem] text-muted-foreground">
              {ready.length} {ready.length === 1 ? "chapter" : "chapters"}, about 8 cards each
            </span>
          </button>
        </div>
        {error ? (
          <p role="alert" className="animate-fade text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {basic ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[10px] border border-dashed px-3 py-2 text-[0.8125rem] text-muted-foreground">
          The AI is busy, so these are basic cards from the key terms.
          <button
            type="button"
            className="text-foreground underline decoration-foreground/30 underline-offset-4"
            onClick={() => void load(scope)}
          >
            Try for a full deck
          </button>
        </p>
      ) : null}
      <Deck
        key={`${scope}-${cards.length}`}
        cards={cards}
        videoId={videoId}
        language={language}
        title={scope === "all" ? "Whole lecture" : (cards[0]?.chapterTitle ?? "This chapter")}
        onSeek={onSeek}
        onChange={() => {
          setCards(null);
          setScope(null);
        }}
      />
    </div>
  );
}

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function Deck({
  cards,
  videoId,
  language,
  title,
  onSeek,
  onChange,
}: {
  cards: Card[];
  videoId: string;
  language: OutputLanguage;
  title: string;
  onSeek: (seconds: number) => void;
  onChange: () => void;
}) {
  const reduce = useReducedMotion();
  const [queue, setQueue] = useState<Card[]>(cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [round, setRound] = useState(1);
  const [exit, setExit] = useState<Mark>("know");
  const card = queue[index] ?? null;
  const known = useMemo(() => Object.values(marks).filter((m) => m === "know").length, [marks]);
  const learning = useMemo(() => cards.filter((c) => marks[c.id] === "learning"), [cards, marks]);

  const mark = (m: Mark) => {
    if (!card) return;
    setExit(m);
    setMarks((prev) => ({ ...prev, [card.id]: m }));
    setFlipped(false);
    setIndex((i) => i + 1);
  };
  const undo = () => {
    if (index === 0) return;
    const prev = queue[index - 1];
    if (prev) {
      setMarks((m) => {
        const next = { ...m };
        delete next[prev.id];
        return next;
      });
    }
    setFlipped(false);
    setIndex((i) => i - 1);
  };
  const restart = (next: Card[], nextRound: number) => {
    setQueue(next);
    setIndex(0);
    setFlipped(false);
    setRound(nextRound);
    if (nextRound === 1) setMarks({});
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      setFlipped((f) => !f);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      mark("know");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      mark("learning");
    }
  };

  const remaining = queue.length - index;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[0.8125rem] text-muted-foreground">
          <span className="text-foreground">{title}</span>
          {round > 1 ? " · second round" : ""}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" size="xs" variant="ghost" onClick={() => restart(shuffled(queue.slice(index)).length ? [...queue.slice(0, index), ...shuffled(queue.slice(index))] : queue, round)}>
            <RefreshIcon />
            Shuffle
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={onChange}>
            Change
          </Button>
        </div>
      </div>

      {/* Progress: known (brand), still learning (muted), left. */}
      <div aria-hidden className="flex h-1 gap-0.5 overflow-hidden rounded-full bg-muted">
        <span className="bg-brand transition-[flex-grow] duration-300 ease-(--ease-out)" style={{ flexGrow: known }} />
        <span className="bg-foreground/30 transition-[flex-grow] duration-300 ease-(--ease-out)" style={{ flexGrow: learning.length }} />
        <span style={{ flexGrow: Math.max(0, cards.length - known - learning.length) }} />
      </div>

      {card ? (
        <>
          <div
            tabIndex={0}
            role="group"
            aria-roledescription="flashcard"
            aria-label={`Card ${index + 1} of ${queue.length}. ${flipped ? "Answer side" : "Question side"}. Space flips, right arrow: know it, left arrow: still learning.`}
            onKeyDown={onKeyDown}
            className="relative aspect-[5/4] rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {/* The rest of the deck, peeking out behind the top card. */}
            {remaining > 2 ? <span aria-hidden className="absolute inset-x-6 -bottom-2 h-full rounded-2xl border bg-surface" /> : null}
            {remaining > 1 ? <span aria-hidden className="absolute inset-x-3 -bottom-1 h-full rounded-2xl border bg-card" /> : null}
            <AnimatePresence initial={false} custom={exit} mode="popLayout">
              <motion.div
                key={`${round}-${card.id}`}
                className="absolute inset-0"
                custom={exit}
                variants={reduce ? REDUCED_VARIANTS : CARD_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <FlipCard card={card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} onSeek={onSeek} />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => mark("learning")}>
              <ArrowBackIcon />
              Still learning
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Flip card" onClick={() => setFlipped((f) => !f)}>
              <FlipIcon />
            </Button>
            <Button type="button" size="sm" className="flex-1" onClick={() => mark("know")}>
              Know it
              <ArrowForwardIcon />
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 text-[0.75rem] text-faint">
            <span className="font-mono tabular-nums">
              {index + 1}/{queue.length}
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <Kbd>Space</Kbd> flip <Kbd>←</Kbd> learning <Kbd>→</Kbd> know
            </span>
            <button
              type="button"
              disabled={index === 0}
              onClick={undo}
              className="inline-flex items-center gap-1 transition-colors duration-150 ease-(--ease-out) disabled:opacity-40 [@media(hover:hover)]:hover:text-foreground"
            >
              <UndoIcon className="size-3.5" />
              Undo
            </button>
          </div>
        </>
      ) : (
        <DeckDone
          total={cards.length}
          known={known}
          learning={learning}
          videoId={videoId}
          language={language}
          onSeek={onSeek}
          onReviewLearning={() => restart(shuffled(learning), round + 1)}
          onRestart={() => restart(cards, 1)}
        />
      )}
    </div>
  );
}

function FlipCard({ card, flipped, onFlip, onSeek }: { card: Card; flipped: boolean; onFlip: () => void; onSeek: (seconds: number) => void }) {
  const reduce = useReducedMotion();
  const face =
    "absolute inset-0 flex flex-col rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.12),0_12px_32px_-12px_rgb(0_0_0/0.35)] backface-hidden dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04),0_12px_32px_-12px_rgb(0_0_0/0.6)]";
  return (
    <div className="size-full perspective-[1200px]">
      <div
        className={cn(
          "relative size-full transform-3d",
          reduce ? "" : "transition-transform duration-500 ease-(--ease-out)",
          flipped && !reduce && "rotate-y-180",
        )}
      >
        {/* Front */}
        <button
          type="button"
          tabIndex={-1}
          onClick={onFlip}
          aria-hidden={flipped}
          className={cn(face, "cursor-pointer text-left", reduce && (flipped ? "invisible" : "visible"))}
        >
          <span className="flex items-center justify-between gap-2 text-[0.75rem] text-faint">
            <span className="inline-flex h-5 items-center rounded-[5px] border px-1.5 text-muted-foreground">{KIND_LABEL[card.kind]}</span>
            <span className="truncate">
              {card.chapterPosition + 1}. {card.chapterTitle}
            </span>
          </span>
          <span className="flex flex-1 items-center justify-center px-2 text-center text-lg leading-snug font-medium text-balance">
            <Markdown inline>{card.front}</Markdown>
          </span>
          <span className="flex items-center justify-center gap-1.5 text-[0.75rem] text-faint">
            <FlipIcon className="size-3.5" />
            Tap to see the answer
          </span>
        </button>
        {/* Back */}
        <div
          aria-hidden={!flipped}
          className={cn(face, "overflow-y-auto", reduce ? (flipped ? "visible" : "invisible") : "rotate-y-180")}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button, a")) return;
            onFlip();
          }}
        >
          <span className="text-[0.75rem] text-faint">Answer</span>
          <div className="flex flex-1 items-center py-2 text-[0.9375rem] leading-relaxed">
            <Markdown>{card.back}</Markdown>
          </div>
          {card.seconds !== null ? (
            <button
              type="button"
              tabIndex={flipped ? 0 : -1}
              onClick={() => onSeek(card.seconds ?? 0)}
              className="inline-flex items-center gap-1.5 self-start rounded-md text-[0.8125rem] text-muted-foreground transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:text-foreground"
            >
              <PlayArrowIcon className="size-4" />
              Where it&apos;s taught · <span className="font-mono tabular-nums">{formatTimestamp(card.seconds)}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DeckDone({
  total,
  known,
  learning,
  videoId,
  language,
  onSeek,
  onReviewLearning,
  onRestart,
}: {
  total: number;
  known: number;
  learning: Card[];
  videoId: string;
  language: OutputLanguage;
  onSeek: (seconds: number) => void;
  onReviewLearning: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="grid gap-4 rounded-2xl border bg-card p-5">
      <div className="grid gap-1">
        <p className="flex items-center gap-2 text-[0.9375rem] font-medium">
          <CheckIcon className="size-4.5 text-positive" />
          Deck done
        </p>
        <p className="text-sm text-muted-foreground">
          You knew <span className="font-mono text-foreground tabular-nums">{known}</span> of{" "}
          <span className="font-mono tabular-nums">{total}</span>.
          {learning.length > 0 ? " Go round once more on the rest, or save them for spaced revision." : " Nice work."}
        </p>
      </div>
      {learning.length > 0 ? (
        <ul className="grid max-h-64 gap-2 overflow-y-auto">
          {learning.map((c) => (
            <li key={c.id} className="grid gap-2 rounded-[10px] border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">
                  <Markdown inline>{c.front}</Markdown>
                </p>
                {c.seconds !== null ? (
                  <button
                    type="button"
                    onClick={() => onSeek(c.seconds ?? 0)}
                    className="shrink-0 font-mono text-[0.75rem] text-muted-foreground tabular-nums [@media(hover:hover)]:hover:text-foreground"
                    aria-label={`Play from ${formatTimestamp(c.seconds)}`}
                  >
                    {formatTimestamp(c.seconds)}
                  </button>
                ) : null}
              </div>
              <SaveConceptButton
                size="xs"
                concept={{
                  youtubeVideoId: videoId,
                  language,
                  sourceSeconds: c.seconds ?? undefined,
                  title: c.front.slice(0, 200),
                  explanationMarkdown: c.back.slice(0, 8000),
                  source: c.kind === "term" ? "key_term" : "manual",
                }}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {learning.length > 0 ? (
          <Button type="button" size="sm" onClick={onReviewLearning}>
            <ReplayIcon />
            Review {learning.length} again
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={onRestart}>
          Start over
        </Button>
      </div>
    </div>
  );
}
