import type { Metadata } from "next";
import { Suspense } from "react";

import { LogoMark } from "@/components/layout/wordmark";
import { FormSkeleton } from "@/features/auth/components/auth-panel";
import { OnboardingForm } from "@/features/auth/components/onboarding-form";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parsePreferences } from "@/types/contracts";

export const metadata: Metadata = { title: "A few questions" };

/** Efferd auth-3 layout: one centred, narrow column with the logo on top. */
export default function OnboardingPage() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center px-4 pt-16 pb-20 md:pt-24">
      <div className="w-full max-w-[30rem]">
        <div className="enter grid justify-items-center text-center">
          <LogoMark className="size-9 rounded-[10px]" />
          <h1 className="mt-6 text-title font-semibold">Three quick questions</h1>
          <p className="mt-3 max-w-[26rem] text-[0.9375rem] leading-relaxed text-muted-foreground">
            They shape how the tutor explains things. All optional, and you can change them later.
          </p>
        </div>
        <div className="enter mt-10 [--i:1]">
          <Suspense fallback={<FormSkeleton />}>
            <OnboardingContent />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function OnboardingContent() {
  const user = await requireUser("/onboarding");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
  const prefs = parsePreferences(profile?.preferences);

  return <OnboardingForm defaults={{ language: prefs.language, level: prefs.level, mathDetail: prefs.mathDetail }} />;
}
