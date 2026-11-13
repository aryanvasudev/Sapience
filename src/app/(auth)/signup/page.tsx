import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthPanel, FormSkeleton, OrDivider } from "@/features/auth/components/auth-panel";
import { GoogleButton } from "@/features/auth/components/google-button";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <AuthPanel title="Create your account" intro="Free to use.">
          <FormSkeleton />
        </AuthPanel>
      }
    >
      <SignUpContent />
    </Suspense>
  );
}

async function SignUpContent() {
  const user = await getCurrentUser();
  if (user && !user.isAnonymous) redirect("/app");
  const isGuest = user?.isAnonymous === true;

  return (
    <AuthPanel
      title={isGuest ? "Keep your progress" : "Create your account"}
      intro={
        isGuest
          ? "You're using Sapience as a guest. Add your email or Google account and everything you've done so far stays with you."
          : "Free to use. Your notes, checkpoint answers and revision stay private to you."
      }
      footer={
        isGuest ? (
          <p>
            <Link href="/app" className="font-medium text-foreground underline decoration-foreground/30 underline-offset-4 transition-[text-decoration-color] duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:decoration-foreground">
              Keep going as a guest
            </Link>
          </p>
        ) : (
          <p>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline decoration-foreground/30 underline-offset-4 transition-[text-decoration-color] duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:decoration-foreground">
              Sign in
            </Link>
          </p>
        )
      }
    >
      <GoogleButton next={isGuest ? "/app" : "/onboarding"} linkToGuest={isGuest} />
      <OrDivider />
      <SignUpForm isGuest={isGuest} />
      <p className="text-sm text-muted-foreground">
        By continuing you agree to how Sapience handles your data, described in{" "}
        <Link href="/privacy" className="text-foreground underline underline-offset-4">
          the privacy note
        </Link>
        .
      </p>
    </AuthPanel>
  );
}
