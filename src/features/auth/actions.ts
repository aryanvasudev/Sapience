"use server";

import type { AuthError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";

import { clientEnv } from "@/env";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { parsePreferences } from "@/types/contracts";
import type { Json } from "@/types/database";

import {
  OnboardingSchema,
  SignInSchema,
  SignUpSchema,
  type ActionResult,
  type OnboardingInput,
  type SignInInput,
  type SignUpInput,
} from "./schemas";

function callbackUrl(next: string) {
  return `${clientEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** Map Supabase auth errors to plain, actionable messages. Never echo raw provider text. */
function authMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "That email and password don't match an account.";
    case "email_not_confirmed":
      return "Confirm your email first. Check your inbox for the link we sent.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Sign in instead.";
    case "weak_password":
      return "Choose a stronger password: at least 8 characters, not a common one.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    case "anonymous_provider_disabled":
      return "Guest access is turned off right now. Create an account to continue.";
    case "captcha_failed":
      return "The security check failed. Reload the page and try again.";
    case "signup_disabled":
      return "New sign-ups are closed right now.";
    default:
      return "Something went wrong signing you in. Try again.";
  }
}

/** Supabase requires a captcha token on every auth endpoint once captcha protection is on. */
function captchaOptions(token: string | undefined): { captchaToken: string } | undefined {
  return token ? { captchaToken: token } : undefined;
}

const CAPTCHA_MISSING = "Complete the security check first.";
const captchaMissing = (token: string | undefined) => Boolean(clientEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY) && !token;

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export async function signInWithPassword(input: SignInInput): Promise<ActionResult> {
  const parsed = SignInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  if (captchaMissing(parsed.data.captchaToken)) return { ok: false, message: CAPTCHA_MISSING };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    options: captchaOptions(parsed.data.captchaToken),
  });
  if (error) return { ok: false, message: authMessage(error) };

  redirect(safeNextPath(parsed.data.next));
}

/**
 * Create an account. If the caller is a guest, upgrade the same user instead (same user ID,
 * so their progress, concepts and revision items stay theirs).
 */
export async function signUpWithPassword(input: SignUpInput): Promise<ActionResult> {
  const parsed = SignUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const { email, password, captchaToken } = parsed.data;

  const supabase = await createClient();
  const current = await getCurrentUser();

  if (current?.isAnonymous) {
    const redirectTo = callbackUrl("/app");
    const both = await supabase.auth.updateUser({ email, password }, { emailRedirectTo: redirectTo });
    if (!both.error) {
      if (both.data.user?.email === email) redirect("/app");
      return {
        ok: true,
        message: `We sent a confirmation link to ${email}. Open it to finish creating your account. Your guest progress is kept.`,
      };
    }
    // Some projects require the email to be verified before a password can be added to an
    // anonymous user. Fall back to linking the email first.
    const emailOnly = await supabase.auth.updateUser({ email }, { emailRedirectTo: redirectTo });
    if (emailOnly.error) return { ok: false, message: authMessage(emailOnly.error) };
    return {
      ok: true,
      message: `We sent a confirmation link to ${email}. Open it to finish creating your account, then set a password from Settings. Your guest progress is kept.`,
    };
  }

  if (captchaMissing(captchaToken)) return { ok: false, message: CAPTCHA_MISSING };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl("/onboarding"), ...captchaOptions(captchaToken) },
  });
  if (error) return { ok: false, message: authMessage(error) };

  // With email confirmation off (local development), Supabase returns a session immediately.
  if (data.session) redirect("/onboarding");

  return {
    ok: true,
    message: `We sent a confirmation link to ${email}. Open it to finish creating your account.`,
  };
}

/** "Try without an account": Supabase anonymous sign-in. */
export async function signInAsGuest(captchaToken?: string): Promise<ActionResult> {
  const token = typeof captchaToken === "string" && captchaToken.length > 0 ? captchaToken : undefined;
  if (captchaMissing(token)) return { ok: false, message: CAPTCHA_MISSING };

  const current = await getCurrentUser();
  if (current) redirect("/app");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously(token ? { options: captchaOptions(token) } : undefined);
  if (error) return { ok: false, message: authMessage(error) };

  redirect("/app");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Save the three optional onboarding answers (or skip them) and mark onboarding done. */
export async function completeOnboarding(input: OnboardingInput | null): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");

  let answers: OnboardingInput | null = null;
  if (input !== null) {
    const parsed = OnboardingSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
    answers = parsed.data;
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();

  const preferences = { ...parsePreferences(profile?.preferences), ...(answers ?? {}) };

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    preferences: preferences as NonNullable<Json>,
    onboarded_at: new Date().toISOString(),
  });
  if (error) return { ok: false, message: "Couldn't save your answers. Try again." };

  redirect("/app");
}
