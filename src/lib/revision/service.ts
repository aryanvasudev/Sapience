import "server-only";

/**
 * Concepts and revision (Section 5.10). User data goes through the user-scoped client, so RLS
 * enforces ownership; only question text (never answers, unless the student has attempted it)
 * is read with the secret key.
 */
import type { CurrentUser } from "@/lib/auth";
import { formatDue } from "@/lib/format";
import { AppError } from "@/lib/errors";
import { toQuestionPublic } from "@/lib/lessons/public-serializer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { newCard, preview, review, stateName, StoredCardSchema, type StoredCard } from "@/features/revision/scheduler";
import { CONCEPT_SOURCES, OUTPUT_LANGUAGES, RECALL_RATINGS, type RecallRating } from "@/config/enums";
import type {
  Concept,
  CreateConceptRequest,
  QuestionPublic,
  RevisionItemView,
} from "@/types/contracts";
import type { Json, Tables } from "@/types/database";

type ConceptRow = Tables<"concepts">;
type ItemRow = Tables<"revision_items">;

const pick = <T extends string>(allowed: readonly T[], value: string | null): T | null =>
  value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;

export function toConcept(row: ConceptRow): Concept {
  return {
    id: row.id,
    youtubeVideoId: row.youtube_video_id,
    language: pick(OUTPUT_LANGUAGES, row.output_language),
    sourceSeconds: row.source_seconds,
    title: row.title,
    explanationMarkdown: row.explanation_markdown,
    questionId: row.question_id,
    source: pick(CONCEPT_SOURCES, row.source) ?? "manual",
    createdAt: row.created_at,
  };
}

async function questionsById(ids: string[]): Promise<Map<string, QuestionPublic>> {
  const map = new Map<string, QuestionPublic>();
  if (ids.length === 0) return map;
  const { data } = await createAdminClient()
    .from("questions")
    .select("id, chapter_id, concept, prompt, options, at_seconds")
    .in("id", ids);
  for (const row of data ?? []) {
    const pub = toQuestionPublic(row);
    if (pub) map.set(row.id, pub);
  }
  return map;
}

async function toView(item: ItemRow, concept: ConceptRow, questions: Map<string, QuestionPublic>, now: Date): Promise<RevisionItemView> {
  const card = StoredCardSchema.parse(item.card);
  return {
    id: item.id,
    concept: toConcept(concept),
    dueAt: item.due_at,
    state: stateName(card),
    reps: item.reps,
    lapses: item.lapses,
    lastRating: pick(RECALL_RATINGS, item.last_rating),
    intervals: await preview(card, now),
    question: concept.question_id ? (questions.get(concept.question_id) ?? null) : null,
  };
}

/**
 * Save a concept and schedule it. Saving the same question, or the same title for the same video,
 * again returns the existing concept (Section 5.10).
 */
export async function saveConcept(user: CurrentUser, input: CreateConceptRequest): Promise<{ concept: Concept; revisionItem: RevisionItemView }> {
  const supabase = await createClient();
  const admin = createAdminClient();
  let explanation = input.explanationMarkdown ?? null;

  if (input.questionId) {
    const { data: question } = await admin
      .from("questions")
      .select("id, source, owner_user_id, explanation")
      .eq("id", input.questionId)
      .maybeSingle();
    if (!question || (question.source !== "checkpoint" && question.owner_user_id !== user.id)) {
      throw new AppError("not_found", "That question doesn't exist.");
    }
    // The explanation reveals the answer: fill it in only once the student has attempted it.
    const { count } = await supabase
      .from("question_attempts")
      .select("id", { count: "exact", head: true })
      .eq("question_id", question.id);
    if ((count ?? 0) > 0 && !explanation) explanation = question.explanation;
  }

  const title = input.title.replace(/\s+/g, " ").trim();
  const row = {
    user_id: user.id,
    youtube_video_id: input.youtubeVideoId ?? null,
    output_language: input.language ?? null,
    source_seconds: input.sourceSeconds ?? null,
    title,
    explanation_markdown: explanation,
    question_id: input.questionId ?? null,
    source: input.source,
  };

  let concept: ConceptRow | null = null;
  const inserted = await supabase.from("concepts").insert(row).select("*").maybeSingle();
  if (inserted.data) {
    concept = inserted.data;
  } else if (inserted.error?.code === "23505") {
    // Already saved: return the existing one.
    const existing = input.questionId
      ? await supabase.from("concepts").select("*").eq("question_id", input.questionId).maybeSingle()
      : await supabase
          .from("concepts")
          .select("*")
          .eq("title", title)
          .filter("youtube_video_id", input.youtubeVideoId ? "eq" : "is", input.youtubeVideoId ?? null)
          .maybeSingle();
    concept = existing.data;
  }
  if (!concept) throw new AppError("internal");

  const now = new Date();
  let { data: item } = await supabase.from("revision_items").select("*").eq("concept_id", concept.id).maybeSingle();
  if (!item) {
    const card = await newCard(now);
    const created = await supabase
      .from("revision_items")
      .insert({
        user_id: user.id,
        concept_id: concept.id,
        card: card as unknown as NonNullable<Json>,
        due_at: card.dueAt,
        state: stateName(card),
        reps: card.reps,
        lapses: card.lapses,
      })
      .select("*")
      .maybeSingle();
    item = created.data;
    if (!item && created.error?.code === "23505") {
      item = (await supabase.from("revision_items").select("*").eq("concept_id", concept.id).maybeSingle()).data;
    }
  }
  if (!item) throw new AppError("internal");

  const questions = await questionsById(concept.question_id ? [concept.question_id] : []);
  return { concept: toConcept(concept), revisionItem: await toView(item, concept, questions, now) };
}

export type RevisionFilter = "due" | "upcoming" | "all";
const UPCOMING_DAYS = 7;

export async function listRevision(filter: RevisionFilter): Promise<RevisionItemView[]> {
  const supabase = await createClient();
  const now = new Date();
  let query = supabase.from("revision_items").select("*, concepts!inner(*)").order("due_at", { ascending: true }).limit(200);
  if (filter === "due") query = query.lte("due_at", now.toISOString());
  if (filter === "upcoming") {
    query = query.gt("due_at", now.toISOString()).lte("due_at", new Date(now.getTime() + UPCOMING_DAYS * 86_400_000).toISOString());
  }
  const { data, error } = await query;
  if (error) throw new AppError("internal");

  const rows = data ?? [];
  const questions = await questionsById(rows.flatMap((r) => (r.concepts.question_id ? [r.concepts.question_id] : [])));
  return Promise.all(rows.map(({ concepts, ...item }) => toView(item, concepts, questions, now)));
}

export async function dueCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("revision_items")
    .select("id", { count: "exact", head: true })
    .lte("due_at", new Date().toISOString());
  return count ?? 0;
}

export async function reviewItem(user: CurrentUser, itemId: string, rating: RecallRating): Promise<RevisionItemView> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("revision_items").select("*, concepts!inner(*)").eq("id", itemId).maybeSingle();
  if (!row) throw new AppError("not_found", "That revision item doesn't exist.");
  const { concepts: concept, ...item } = row;

  const now = new Date();
  const current: StoredCard = StoredCardSchema.parse(item.card);
  const next = await review(current, rating, now);

  const { data: updated, error } = await supabase
    .from("revision_items")
    .update({
      card: next.card as unknown as NonNullable<Json>,
      due_at: next.card.dueAt,
      state: stateName(next.card),
      reps: next.card.reps,
      lapses: next.card.lapses,
      last_rating: rating,
      last_reviewed_at: now.toISOString(),
    })
    .eq("id", item.id)
    .select("*")
    .single();
  if (error || !updated) throw new AppError("internal");

  const { error: logError } = await supabase.from("revision_reviews").insert({
    user_id: user.id,
    revision_item_id: item.id,
    rating,
    reviewed_at: now.toISOString(),
    prev_due_at: current.dueAt,
    next_due_at: next.card.dueAt,
    log: next.log as NonNullable<Json>,
  });
  if (logError) console.error("[revision] logging the review failed:", logError.code);

  const questions = await questionsById(concept.question_id ? [concept.question_id] : []);
  return toView(updated, concept, questions, now);
}

/** The revision page's three groups: due now, the next 7 days, and later. */
export async function listRevisionGrouped(): Promise<{
  due: RevisionItemView[];
  upcoming: RevisionItemView[];
  later: RevisionItemView[];
  /** When the next not-yet-due item comes back, e.g. "Due tomorrow"; null if none. */
  nextDueLabel: string | null;
}> {
  const items = await listRevision("all");
  const now = Date.now();
  const week = now + UPCOMING_DAYS * 86_400_000;
  const at = (i: RevisionItemView) => new Date(i.dueAt).getTime();
  const notDue = items.filter((i) => at(i) > now).sort((a, b) => at(a) - at(b));
  return {
    due: items.filter((i) => at(i) <= now),
    upcoming: notDue.filter((i) => at(i) <= week),
    later: notDue.filter((i) => at(i) > week),
    nextDueLabel: notDue[0] ? formatDue(notDue[0].dueAt, now) : null,
  };
}
