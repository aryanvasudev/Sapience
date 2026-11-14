import { describe, expect, it } from "vitest";

import { addQuestion, applyAnswer, currentTopic, finishEarly, pending, pickTopics, startState, type QuizState } from "@/lib/quiz/engine";

const ask = (s: QuizState, id: string) =>
  addQuestion(s, { questionId: id, prompt: `Q ${id}`, concept: "c", startSeconds: 0, endSeconds: 10 });

describe("adaptive quiz engine", () => {
  it("starts at level 2 on the first topic", () => {
    const s = startState([0, 2], "lesson");
    expect(s.level).toBe(2);
    expect(currentTopic(s)).toBe(0);
  });

  it("goes one level harder after a right answer and one easier after a wrong one, on the same topic", () => {
    let s = ask(startState([0, 1], "lesson"), "a");
    let r = applyAnswer(s, true);
    expect(r.state.level).toBe(3);
    expect(currentTopic(r.state)).toBe(0);
    s = ask(r.state, "b");
    r = applyAnswer(s, false, "B");
    expect(r.state.level).toBe(2);
    expect(currentTopic(r.state)).toBe(0);
    expect(r.state.history[1]?.chosen).toBe("B");
  });

  it("never drops below level 1", () => {
    let s = ask(startState([0], "chapter"), "a");
    let r = applyAnswer(s, false);
    s = ask(r.state, "b");
    r = applyAnswer(s, false);
    expect(r.state.level).toBe(1);
  });

  it("finishes a topic as solid when a level-4 question is answered right", () => {
    let s = startState([0, 1], "chapter");
    for (const id of ["a", "b"]) {
      s = applyAnswer(ask(s, id), true).state;
    }
    expect(s.level).toBe(4);
    const r = applyAnswer(ask(s, "c"), true);
    expect(r.topicDone).toEqual({ topic: 0, outcome: "solid" });
    expect(currentTopic(r.state)).toBe(1);
    expect(r.state.level).toBe(2);
  });

  it("ends a topic after three wrong answers with 'rewatch'", () => {
    let s = startState([0, 1], "chapter");
    let r = applyAnswer(ask(s, "a"), false);
    r = applyAnswer(ask(r.state, "b"), false);
    expect(r.topicDone).toBeNull();
    r = applyAnswer(ask(r.state, "c"), false);
    expect(r.topicDone).toEqual({ topic: 0, outcome: "rewatch" });
    s = r.state;
    expect(currentTopic(s)).toBe(1);
  });

  it("does not end a topic straight after a wrong answer at the question limit", () => {
    // lesson scope: 4 per topic. right, right, wrong(L4), then the 4th answer is wrong.
    let s = startState([0, 1], "lesson");
    let r = applyAnswer(ask(s, "a"), true); // L2 → 3
    r = applyAnswer(ask(r.state, "b"), true); // L3 → 4
    r = applyAnswer(ask(r.state, "c"), false); // L4 wrong → 3
    r = applyAnswer(ask(r.state, "d"), true); // L3 right, asked 4 ≥ max → solid
    expect(r.topicDone).toEqual({ topic: 0, outcome: "solid" });

    s = startState([0], "lesson");
    r = applyAnswer(ask(s, "a"), true);
    r = applyAnswer(ask(r.state, "b"), false);
    r = applyAnswer(ask(r.state, "c"), true);
    r = applyAnswer(ask(r.state, "d"), false); // 4th, wrong: keep going
    expect(r.topicDone).toBeNull();
    r = applyAnswer(ask(r.state, "e"), true); // right after the limit → ends
    expect(r.topicDone?.outcome).toBe("getting_there");
    expect(r.done).toBe(true);
  });

  it("marks the quiz done after the last topic and refuses a second pending question", () => {
    const s = ask(startState([3], "chapter"), "a");
    expect(pending(s)?.questionId).toBe("a");
    expect(() => ask(s, "b")).toThrow();
  });

  it("finishing early keeps only started topics, with outcomes", () => {
    let s = startState([0, 1, 2], "lesson");
    const r = applyAnswer(ask(s, "a"), true);
    s = ask(r.state, "b"); // pending, dropped
    const f = finishEarly(s);
    expect(f.topics).toEqual([0]);
    expect(f.perTopic["0"]?.outcome).toBe("getting_there");
    expect(f.history).toHaveLength(1);
  });

  it("picks weak topics first, then spreads the rest, in lecture order", () => {
    expect(pickTopics([0, 1, 2], [], 6)).toEqual([0, 1, 2]);
    expect(pickTopics([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [7], 4)).toEqual([0, 3, 6, 7]);
    expect(pickTopics([0, 1], [5], 4)).toEqual([0, 1]);
  });
});
