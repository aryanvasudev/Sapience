import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardSections, DashboardSectionsSkeleton } from "@/features/dashboard/dashboard-sections";
import { PasteBox } from "@/features/dashboard/paste-box";
import { capabilities } from "@/lib/ai/provider";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parsePreferences } from "@/types/contracts";

export const metadata: Metadata = { title: "Home" };

export default function DashboardPage() {
  return (
    <div className="grid gap-14">
      <section aria-labelledby="start-heading" className="max-w-[44rem]">
        <h1
          id="start-heading"
          className="font-serif text-title font-medium"
        >
          Start a lesson
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
          Paste a link to a public YouTube lecture between 1 and 90 minutes long.
        </p>
        <div className="mt-6">
          <Suspense fallback={<div aria-hidden className="h-14 animate-pulse rounded-[14px] bg-muted motion-reduce:animate-none" />}>
            <PasteBoxLoader />
          </Suspense>
        </div>
      </section>

      <Suspense fallback={<DashboardSectionsSkeleton />}>
        <DashboardSections />
      </Suspense>
    </div>
  );
}

async function PasteBoxLoader() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
  return (
    <PasteBox defaultLanguage={parsePreferences(profile?.preferences).language} videoLessons={capabilities().videoLessons} />
  );
}
