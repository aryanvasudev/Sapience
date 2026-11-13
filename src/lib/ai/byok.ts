import "server-only";

/**
 * Students' own AI keys (Section 4.5.4). Stored encrypted in `user_api_keys`, which has RLS on
 * and no policies, so only this module (secret-key client) reads or writes it. The plaintext key
 * is only ever handed to `runWithUserKey`; the browser sees the provider and last 4 characters.
 */
import { generateText } from "ai";

import { serverEnv } from "@/env";
import type { CurrentUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { fromBytea, openSecret, sealSecret, toBytea } from "@/lib/crypto/byok";
import { consumeAiQuota, consumeLessonQuota } from "@/lib/quota";
import { createAdminClient } from "@/lib/supabase/admin";

import { isRateLimitError } from "./errors";
import { chainsForKeyCheck, languageModel, runWithUserKey, type AiProviderName, type UserAiKey } from "./provider";

export type KeyStatus = { provider: AiProviderName; last4: string; validatedAt: string | null };

/** Whether this deployment can store keys at all (needs BYOK_ENCRYPTION_KEY). */
export const byokEnabled = (): boolean => Boolean(serverEnv().BYOK_ENCRYPTION_KEY);

export async function keyStatus(userId: string): Promise<KeyStatus | null> {
  if (!byokEnabled()) return null;
  const { data } = await createAdminClient()
    .from("user_api_keys")
    .select("provider, last4, validated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || (data.provider !== "gemini" && data.provider !== "openrouter")) return null;
  return { provider: data.provider, last4: data.last4, validatedAt: data.validated_at };
}

/** The decrypted key, or null if none is stored, BYOK is off, or it can't be decrypted. */
export async function loadUserKey(userId: string): Promise<UserAiKey | null> {
  const master = serverEnv().BYOK_ENCRYPTION_KEY;
  if (!master) return null;
  const { data } = await createAdminClient()
    .from("user_api_keys")
    .select("provider, ciphertext, iv")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || (data.provider !== "gemini" && data.provider !== "openrouter")) return null;
  try {
    const apiKey = openSecret({ ciphertext: fromBytea(data.ciphertext), iv: fromBytea(data.iv) }, master);
    return { userId, provider: data.provider, apiKey };
  } catch {
    console.error("[byok] stored key could not be decrypted");
    return null;
  }
}

export type AiRole = "text" | "video";

/** The student's key if it can serve this role (Gemini: both; OpenRouter: text, video if configured). */
export async function userKeyFor(userId: string, role: AiRole): Promise<UserAiKey | null> {
  const key = await loadUserKey(userId);
  if (!key) return null;
  const chains = chainsForKeyCheck(key.provider);
  const usable = role === "video" ? chains.video !== null : chains.text.length > 0;
  return usable ? key : null;
}

/**
 * Run an AI request (tutor, search, check question). With a usable key of their own the student
 * skips the app's daily AI limit and the request runs on their key; otherwise it counts.
 */
export async function withAiAccess<T>(user: CurrentUser, fn: () => Promise<T>): Promise<T> {
  const key = await userKeyFor(user.id, "text");
  if (!key) await consumeAiQuota(user);
  try {
    return await runWithUserKey(key, fn);
  } catch (error) {
    if (error instanceof AppError && error.code === "ai_busy") throw new AppError("ai_busy", busyMessage(key !== null));
    throw error;
  }
}

/** Section 10, `ai_busy`, with the P1 hint about using your own key. */
function busyMessage(onOwnKey: boolean): string | undefined {
  if (onOwnKey) return "Your own AI key has hit its free limit for now. Notes, checkpoints, search and revision still work. Try again later.";
  if (byokEnabled()) {
    return "Sapience runs on free AI capacity and it's used up for now. Notes, checkpoints, search and revision still work. Try again later, or add your own free key in Settings.";
  }
  return undefined;
}

/** For lesson builds: the key to record on the job, after the lesson limit (skipped with a key). */
export async function lessonKey(user: CurrentUser, role: AiRole): Promise<UserAiKey | null> {
  const key = await userKeyFor(user.id, role);
  if (!key) await consumeLessonQuota(user);
  return key;
}

export type SaveKeyResult = { ok: true; status: KeyStatus } | { ok: false; message: string };

const KeyFormat = /^[\x21-\x7e]{20,300}$/;

/** Check the key with one small call on its own provider, then store it encrypted. */
export async function saveUserKey(user: CurrentUser, provider: AiProviderName, rawKey: string): Promise<SaveKeyResult> {
  const master = serverEnv().BYOK_ENCRYPTION_KEY;
  if (!master) return { ok: false, message: "This deployment isn't set up to store personal keys." };
  const apiKey = rawKey.trim();
  if (!KeyFormat.test(apiKey)) return { ok: false, message: "That doesn't look like an API key. Paste the whole key, with no spaces." };

  const [spec] = chainsForKeyCheck(provider).text;
  if (!spec) return { ok: false, message: "Sapience isn't configured with an OpenRouter model, so OpenRouter keys can't be used here." };

  const check = await runWithUserKey({ userId: user.id, provider, apiKey }, async () => {
    try {
      await generateText({
        model: languageModel(spec),
        prompt: "Reply with the single word OK.",
        maxOutputTokens: 16,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(20_000),
      });
      return "ok" as const;
    } catch (error) {
      // A rate-limited key is still a real key.
      return isRateLimitError(error) ? ("ok" as const) : ("invalid" as const);
    }
  });
  if (check !== "ok") {
    return { ok: false, message: `That ${provider === "gemini" ? "Gemini" : "OpenRouter"} key didn't work. Check it was copied in full and is active.` };
  }

  const sealed = sealSecret(apiKey, master);
  const validatedAt = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("user_api_keys")
    .upsert(
      {
        user_id: user.id,
        provider,
        ciphertext: toBytea(sealed.ciphertext),
        iv: toBytea(sealed.iv),
        last4: apiKey.slice(-4),
        validated_at: validatedAt,
      },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("[byok] save failed:", error.code);
    return { ok: false, message: "Couldn't save your key. Try again." };
  }
  return { ok: true, status: { provider, last4: apiKey.slice(-4), validatedAt } };
}

export async function removeUserKey(userId: string): Promise<boolean> {
  const { error } = await createAdminClient().from("user_api_keys").delete().eq("user_id", userId);
  return !error;
}
