import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthPanel, FormSkeleton, OrDivider } from "@/features/auth/components/auth-panel";
import { GoogleButton } from "@/features/auth/components/google-button";
import { GuestButton } from "@/features/auth/components/guest-button";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { safeNextPath } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

const CALLBACK_ERRORS: Record<string, string> = {
  callback: "That sign-in link didn't work. It may have expired. Sign in again.",
  identity_exists: "That Google account already belongs to another Sapience account. Sign in with it instead.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthPanel
      title="Sign in"
      intro="Your lessons, checkpoint answers and revision queue are where you left them."
      footer={
        <>
          <p>
            New to Sapience?{" "}
            <Link href="/signup" className="font-medium text-foreground underline decoration-foreground/30 underline-offset-4 transition-[text-decoration-color] duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:decoration-foreground">
              Create an account
            </Link>
          </p>
          <div className="flex flex-wrap items-center gap-x-1">
            Just looking?
            <GuestButton
              label="Try a lesson without an account"
              variant="link"
              className="inline-grid"
              buttonClassName="h-11 px-0 text-sm font-medium md:h-auto"
            />
          </div>
        </>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <LoginForms searchParams={searchParams} />
      </Suspense>
    </AuthPanel>
  );
}

async function LoginForms({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined);
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const callbackError = errorKey ? CALLBACK_ERRORS[errorKey] : undefined;

  return (
    <>
      {callbackError ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          {callbackError}
        </p>
      ) : null}
      <GoogleButton next={next} />
      <OrDivider />
      <SignInForm next={next} />
    </>
  );
}
