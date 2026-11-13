"use server";

/**
 * Settings (Section 6.1, 8): preferences, password, tutor history and account deletion. Every
 * action re-reads the user on the server and uses the user-scoped client (RLS), except account
 * deletion, which needs the admin API and only ever deletes the caller.
 */
import { redirect } from "next/navigation";
import { z } from "zod";

import { removeUserKey, saveUserKey } from "@/lib/ai/byok";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PreferencesSchema, type Preferences } from "@/types/contracts";
import type { Json } from "@/types/database";

export type SettingsResult = { ok: true; message: string } | { ok: false; message: string };

export async function updatePreferences(input: Preferences): Promise<SettingsResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/settings");
  const parsed = PreferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Something in the form wasn't right. Refresh and try again." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ preferences: parsed.data as NonNullable<Json> })
    .eq("id", user.id);
  if (error) return { ok: false, message: "Couldn't save your preferences. Try again." };
  return { ok: true, message: "Saved. New lessons and tutor answers use these." };
}

const PasswordSchema = z.object({ password: z.string().min(8, "Use at least 8 characters.").max(200) });

/** For accounts created from a guest with email only, and for changing a password. */
export async function setPassword(input: { password: string }): Promise<SettingsResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/settings");
  if (user.isAnonymous) return { ok: false, message: "Create an account first." };
  const parsed = PasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password") return { ok: false, message: "Choose a stronger password: at least 8 characters, not a common one." };
    if (error.code === "same_password") return { ok: false, message: "That's already your password." };
    if (error.code === "reauthentication_needed") return { ok: false, message: "Sign out and sign in again, then change your password." };
    return { ok: false, message: "Couldn't change your password. Try again." };
  }
  return { ok: true, message: "Password saved." };
}

/** Delete every tutor conversation (messages cascade). */
export async function deleteTutorHistory(): Promise<SettingsResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/settings");
  const supabase = await createClient();
  const { error } = await supabase.from("conversations").delete().eq("user_id", user.id);
  if (error) return { ok: false, message: "Couldn't delete your tutor history. Try again." };
  return { ok: true, message: "Tutor history deleted." };
}

const DeleteAccountSchema = z.object({ confirm: z.literal("delete") });

/**
 * Delete the caller's account. Every user table references auth.users with `on delete cascade`,
 * so progress, attempts, conversations, concepts and revision go with it.
 */
export async function deleteAccount(input: { confirm: string }): Promise<SettingsResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!DeleteAccountSchema.safeParse(input).success) return { ok: false, message: 'Type "delete" to confirm.' };

  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[settings] deleteUser failed:", error.code ?? error.status);
    return { ok: false, message: "Couldn't delete your account. Try again." };
  }
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  redirect("/?account=deleted");
}

// ---------------------------------------------------------------------------
// Bring your own key (Section 4.5.4)
// ---------------------------------------------------------------------------

const AiKeySchema = z.object({ provider: z.enum(["gemini", "openrouter"]), apiKey: z.string().min(1).max(400) });

export type AiKeyResult =
  | { ok: true; message: string; status: { provider: "gemini" | "openrouter"; last4: string; validatedAt: string | null } }
  | { ok: false; message: string };

/** Check the key with one small call, then store it encrypted. Only the last 4 characters come back. */
export async function saveAiKey(input: { provider: string; apiKey: string }): Promise<AiKeyResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/settings");
  const parsed = AiKeySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a provider and paste a key." };
  const result = await saveUserKey(user, parsed.data.provider, parsed.data.apiKey);
  if (!result.ok) return result;
  return { ok: true, message: "Key checked and saved. Your lessons and tutor now use it.", status: result.status };
}

export async function removeAiKey(): Promise<SettingsResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/settings");
  if (!(await removeUserKey(user.id))) return { ok: false, message: "Couldn't remove your key. Try again." };
  return { ok: true, message: "Key removed. Sapience's shared free capacity and daily limits apply again." };
}
