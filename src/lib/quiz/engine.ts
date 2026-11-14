/**
 * Adaptive "Check yourself" quiz (pure). Each topic is a chapter of the lecture.
 *
 * - A topic starts at level 2 (Understand). Levels: 1 Recall, 2 Understand, 3 Apply, 4 Challenge.
 * - Right answer: the next question on the topic is one level harder. Right at level 4: the topic
 *   is done ("solid").
 * - Wrong answer: the next question stays on the same topic, one level easier, aimed at the
 *   mistake, so a wrong answer is always followed by a chance to clear it up. Three wrong answers
 *   on a topic end it ("rewatch") instead of grinding on.
 * - A topic also ends after `maxPerTopic` questions, but never straight after a wrong answer.
 */
import type { QuizLevel, QuizScope } from "@/config/enums";

export type TopicOutcome = "solid" | "getting_there" | "rewatch";

export type TopicProgress = {
  asked: number;
  correct: number;
  wrong: number;
  /** Highest level answered correctly (0 = none). */
  bestLevel: number;
  outcome: TopicOutcome | null;
};

export type HistoryEntry = {
  questionId: string;
  topic: number;
  level: QuizLevel;
  prompt: string;
  concept: string;
  /** null until answered. */
  correct: boolean | null;
  /** The option the student picked, for aiming the follow-up. */
  chosen: string | null;
  /** The part of the lecture the question is grounded in. */
  startSeconds: number;
  endSeconds: number;
};

export type QuizState = {
  version: 1;
  topics: number[];
  topicIndex: number;
  level: QuizLevel;
  maxPerTopic: number;
  perTopic: Record<string, TopicProgress>;
  history: HistoryEntry[];
};

export const START_LEVEL: QuizLevel = 2;
const MAX_WRONG_PER_TOPIC = 3;
export const MAX_PER_TOPIC: Record<QuizScope, number> = { lesson: 4, chapter: 8 };

const clampLevel = (n: number): QuizLevel => (Math.min(4, Math.max(1, n)) as QuizLevel);

export function startState(topics: number[], scope: QuizScope): QuizState {
  return {
    version: 1,
    topics,
    topicIndex: 0,
    level: START_LEVEL,
    maxPerTopic: MAX_PER_TOPIC[scope],
    perTopic: Object.fromEntries(topics.map((t) => [String(t), { asked: 0, correct: 0, wrong: 0, bestLevel: 0, outcome: null }])),
    history: [],
  };
}

export const isDone = (state: QuizState): boolean => state.topicIndex >= state.topics.length;

export function currentTopic(state: QuizState): number | null {
  return isDone(state) ? null : (state.topics[state.topicIndex] ?? null);
}

/** The question waiting for an answer, if any. */
export function pending(state: QuizState): HistoryEntry | null {
  const last = state.history[state.history.length - 1];
  return last && last.correct === null ? last : null;
}

/** The answered question just before the pending one on the same topic, for aiming the next one. */
export function lastAnsweredOnTopic(state: QuizState, topic: number): HistoryEntry | null {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i];
    if (h && h.topic === topic && h.correct !== null) return h;
  }
  return null;
}

export function addQuestion(state: QuizState, entry: Omit<HistoryEntry, "correct" | "chosen" | "topic" | "level">): QuizState {
  const topic = currentTopic(state);
  if (topic === null) throw new Error("quiz: no topic left");
  if (pending(state)) throw new Error("quiz: a question is already waiting");
  return { ...state, history: [...state.history, { ...entry, topic, level: state.level, correct: null, chosen: null }] };
}

export type AnswerOutcome = {
  state: QuizState;
  /** Set when this answer finished the topic. */
  topicDone: { topic: number; outcome: TopicOutcome } | null;
  done: boolean;
};

export function applyAnswer(state: QuizState, correct: boolean, chosen: string | null = null): AnswerOutcome {
  const entry = pending(state);
  if (!entry) throw new Error("quiz: no question waiting");
  const key = String(entry.topic);
  const prev = state.perTopic[key] ?? { asked: 0, correct: 0, wrong: 0, bestLevel: 0, outcome: null };
  const progress: TopicProgress = {
    ...prev,
    asked: prev.asked + 1,
    correct: prev.correct + (correct ? 1 : 0),
    wrong: prev.wrong + (correct ? 0 : 1),
    bestLevel: correct ? Math.max(prev.bestLevel, entry.level) : prev.bestLevel,
  };

  let outcome: TopicOutcome | null = null;
  if (correct && entry.level === 4) outcome = "solid";
  else if (!correct && progress.wrong >= MAX_WRONG_PER_TOPIC) outcome = "rewatch";
  else if (correct && progress.asked >= state.maxPerTopic) outcome = entry.level >= 3 ? "solid" : "getting_there";
  // Over the limit after a wrong answer: one more (easier) question, then stop at the hard cap.
  else if (!correct && progress.asked >= state.maxPerTopic + 2) outcome = progress.bestLevel >= 2 ? "getting_there" : "rewatch";

  const history = state.history.map((h, i) => (i === state.history.length - 1 ? { ...h, correct, chosen } : h));
  const perTopic = { ...state.perTopic, [key]: { ...progress, outcome } };

  if (outcome) {
    const next: QuizState = { ...state, history, perTopic, topicIndex: state.topicIndex + 1, level: START_LEVEL };
    return { state: next, topicDone: { topic: entry.topic, outcome }, done: isDone(next) };
  }
  const level = clampLevel(entry.level + (correct ? 1 : -1));
  return { state: { ...state, history, perTopic, level }, topicDone: null, done: false };
}

/** End early: topics already started get an outcome from what was answered; the rest are dropped. */
export function finishEarly(state: QuizState): QuizState {
  const perTopic = { ...state.perTopic };
  const topics: number[] = [];
  for (const t of state.topics) {
    const p = perTopic[String(t)];
    if (!p || p.asked === 0) continue;
    topics.push(t);
    if (!p.outcome) {
      perTopic[String(t)] = {
        ...p,
        outcome: p.wrong === 0 && p.bestLevel >= 3 ? "solid" : p.correct > 0 ? "getting_there" : "rewatch",
      };
    }
  }
  const history = state.history.filter((h) => h.correct !== null);
  return { ...state, topics, perTopic, history, topicIndex: topics.length };
}

/** Pick up to `max` topics for a whole-lecture quiz: weak chapters first, then spread over the rest, in lecture order. */
export function pickTopics(ready: number[], weak: number[], max = 6): number[] {
  const set = new Set<number>();
  for (const w of weak) if (ready.includes(w) && set.size < max) set.add(w);
  const rest = ready.filter((p) => !set.has(p));
  const room = max - set.size;
  if (room > 0 && rest.length > 0) {
    if (rest.length <= room) rest.forEach((p) => set.add(p));
    else for (let i = 0; i < room; i++) set.add(rest[Math.floor((i * rest.length) / room)]!);
  }
  return [...set].sort((a, b) => a - b);
}
