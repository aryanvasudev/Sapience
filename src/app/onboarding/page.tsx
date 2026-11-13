import type { Metadata } from "next";
import { Suspense } from "react";

import { NotebookFrame } from "@/components/layout/notebook-frame";
import { FormSkeleton } from "@/features/auth/components/auth-panel";
import { OnboardingForm } from "@/features/auth/components/onboarding-form";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parsePreferences } from "@/types/contracts";

export const metadata: Metadata = { title: "A few questions" };

export default function OnboardingPage() {
  return (
    <NotebookFrame className="pt-8 md:pt-14">
      <div className="max-w-[40rem]">
        <h1 className="font-serif text-title font-medium">
          Three quick questions
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
          They shape how the tutor explains things. All optional, and you can change them later.
        </p>
        <div className="mt-10">
          <Suspense fallback={<FormSkeleton />}>
            <OnboardingContent />
          </Suspense>
        </div>
      </div>
    </NotebookFrame>
  );
}

async function OnboardingContent() {
  const user = await requireUser("/onboarding");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
  const prefs = parsePreferences(profile?.preferences);

  return <OnboardingForm defaults={{ language: prefs.language, level: prefs.level, mathDetail: prefs.mathDetail }} />;
}
