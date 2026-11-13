/**
 * Section 12.3, the one end-to-end test: guest → fixture lesson → checkpoint (answered wrong) →
 * save concept → recap → revision (due now) → review "Good" → due date moves forward.
 *
 * No AI endpoint is called. The fixture uses a placeholder video ID that YouTube can't play, so
 * the checkpoint is opened from the chapter list (auto-pause turned off in Settings) instead of
 * by playing to the end of a chapter; `crossedCheckpoint` is covered by unit tests.
 *
 * Test helpers use the secret key against the local stack only, to read the correct option (so
 * the test can answer wrong on purpose) and to move `due_at` to now.
 */
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import type { Database } from "../../src/types/database";

const FIXTURE_VIDEO = "FIXTURE0001";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const secretKey = process.env.SUPABASE_SECRET_KEY;

test.skip(!secretKey, "Needs SUPABASE_SECRET_KEY for the local stack (see `pnpm exec supabase status`).");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(supabaseUrl)) {
  throw new Error("The E2E test only runs against a local Supabase stack.");
}

const admin = () =>
  createClient<Database>(supabaseUrl, secretKey as string, { auth: { persistSession: false, autoRefreshToken: false } });

test("guest answers a checkpoint wrong, saves it, and reviews it", async ({ page }) => {
  // 1. Guest sign-in.
  await page.goto("/");
  await page.getByRole("button", { name: "Try without an account" }).first().click();
  await page.waitForURL(/\/(app|onboarding)(\?|$)/);
  if (page.url().includes("/onboarding")) {
    await page.getByRole("button", { name: /skip/i }).click();
    await page.waitForURL(/\/app$/);
  }

  // 2. Checkpoints open from the chapter list when auto-pause is off.
  await page.goto("/app/settings");
  await page.getByRole("checkbox", { name: /Pause for checkpoint questions/ }).uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  // 3. The fixture lesson is labelled and the player is embedded.
  await page.goto(`/app/lesson/${FIXTURE_VIDEO}?lang=en`);
  await expect(page.getByText("Test fixture", { exact: true }).first()).toBeVisible();
  await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(1);

  const lessonResponse = await page.request.get(`/api/lessons/${FIXTURE_VIDEO}?lang=en`);
  expect(lessonResponse.ok()).toBe(true);
  const { lesson } = (await lessonResponse.json()) as {
    lesson: { chapters: { title: string; checkpoint: { id: string; concept: string } | null }[] };
  };
  const checkpoint = lesson.chapters[0]?.checkpoint;
  expect(checkpoint).toBeTruthy();
  const { data: question } = await admin().from("questions").select("correct_index").eq("id", checkpoint!.id).single();
  const wrongIndex = question!.correct_index === 0 ? 1 : 0;

  // 4. Answer the chapter 1 checkpoint wrong and save it.
  await page.getByRole("button", { name: "Take the checkpoint question for chapter 1" }).first().click();
  await page.getByRole("radio").nth(wrongIndex).check({ force: true });
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Worth reviewing").first()).toBeVisible();
  await page.getByRole("button", { name: "Save for revision" }).click();
  await expect(page.getByText("Saved · first review tomorrow")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // 5. The recap counts it.
  await page.getByRole("button", { name: "Lesson recap" }).first().click();
  const recap = page.getByRole("region", { name: /recap/i });
  await expect(recap.getByText("Saved to revise")).toBeVisible();
  await expect(recap.locator("dd").nth(2)).toHaveText("1");
  await expect(recap.getByText("Worth reviewing")).toBeVisible();

  // 6. Make it due now (test helper), then review it as Good.
  const db = admin();
  const { data: concept } = await db.from("concepts").select("id, user_id").eq("question_id", checkpoint!.id).order("created_at", { ascending: false }).limit(1).single();
  expect(concept).toBeTruthy();
  const past = new Date(Date.now() - 60_000).toISOString();
  await db.from("revision_items").update({ due_at: past }).eq("concept_id", concept!.id);

  await page.goto("/app/revision?start=1");
  await page.getByRole("radio").nth(question!.correct_index).check({ force: true });
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: /^Good/ }).click();
  await expect(page.getByText("Done for now")).toBeVisible();

  const { data: item } = await db.from("revision_items").select("due_at, reps").eq("concept_id", concept!.id).single();
  expect(new Date(item!.due_at).getTime()).toBeGreaterThan(Date.now());
  expect(item!.reps).toBeGreaterThanOrEqual(1);

  // 7. The concept is in the Library.
  await page.goto("/app/library");
  await expect(page.getByRole("region", { name: /Saved concepts/ }).getByText(checkpoint!.concept)).toBeVisible();
});
