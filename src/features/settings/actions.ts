"use server";

/**
 * Settings (Section 6.1, 8): preferences, password, tutor history and account deletion. Every
 * action re-reads the user on the server and uses the user-scoped client (RLS), except account
 * deletion, which needs the admin API and only ever deletes the caller.
 */
import { redirect } from "next/navigation";
import { z } from "zod";

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
