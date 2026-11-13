import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  AI_CALL_KINDS,
  BYOK_PROVIDERS,
  CHAPTER_STATUSES,
  CONCEPT_SOURCES,
  JOB_ERROR_CODES,
  JOB_KINDS,
  JOB_STATUSES,
  LESSON_SOURCES,
  LESSON_STATUSES,
  MESSAGE_ROLES,
  NOTE_KINDS,
  OUTPUT_LANGUAGES,
  QUESTION_SOURCES,
  QUOTA_KINDS,
  RECALL_RATINGS,
  REVISION_STATES,
} from "@/config/enums";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const sql = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n");

/** Values of `constraint <name> check (<column> in ('a', 'b', ...))`. */
function constraintValues(name: string): string[] {
  const re = new RegExp(`constraint\\s+${name}\\s+check\\s*\\(\\s*\\w+\\s+in\\s*\\(([^)]*)\\)`, "i");
  const match = re.exec(sql);
  if (!match?.[1]) throw new Error(`Check constraint ${name} not found in migrations`);
  return [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1] ?? "");
}

const CASES: [constraint: string, values: readonly string[]][] = [
  ["lessons_output_language_check", OUTPUT_LANGUAGES],
  ["lessons_source_check", LESSON_SOURCES],
  ["lessons_status_check", LESSON_STATUSES],
  ["lessons_error_code_check", JOB_ERROR_CODES],
  ["lesson_chapters_status_check", CHAPTER_STATUSES],
  ["lesson_jobs_kind_check", JOB_KINDS],
  ["lesson_jobs_status_check", JOB_STATUSES],
  ["lesson_jobs_error_code_check", JOB_ERROR_CODES],
  ["questions_source_check", QUESTION_SOURCES],
  ["ai_calls_kind_check", AI_CALL_KINDS],
  ["lesson_progress_output_language_check", OUTPUT_LANGUAGES],
  ["messages_role_check", MESSAGE_ROLES],
  ["concepts_output_language_check", OUTPUT_LANGUAGES],
  ["concepts_source_check", CONCEPT_SOURCES],
  ["revision_items_state_check", REVISION_STATES],
  ["revision_items_last_rating_check", RECALL_RATINGS],
  ["revision_reviews_rating_check", RECALL_RATINGS],
  ["notes_kind_check", NOTE_KINDS],
  ["user_api_keys_provider_check", BYOK_PROVIDERS],
];

describe("enum ↔ migration check constraints", () => {
  it.each(CASES)("%s matches src/config/enums.ts", (constraint, values) => {
    expect(constraintValues(constraint)).toEqual([...values]);
  });

  it("consume_quota accepts exactly the quota kinds", () => {
    const match = /if p_kind not in \(([^)]*)\)/i.exec(sql);
    expect(match?.[1]).toBeDefined();
    const kinds = [...(match?.[1] ?? "").matchAll(/'([^']*)'/g)].map((m) => m[1]);
    expect(kinds).toEqual([...QUOTA_KINDS]);
  });

  it("every enum-like check constraint in the migrations is covered by this test", () => {
    const found = [...sql.matchAll(/constraint\s+(\w+)\s+check\s*\(\s*\w+\s+in\s*\(/gi)].map((m) => m[1]);
    expect(new Set(found)).toEqual(new Set(CASES.map(([name]) => name)));
  });
});
