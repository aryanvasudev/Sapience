import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { serverEnv } from "@/env";
import { DashboardSections, DashboardSectionsSkeleton } from "@/features/dashboard/dashboard-sections";
import { PasteBox } from "@/features/dashboard/paste-box";
import { capabilities } from "@/lib/ai/provider";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parsePreferences } from "@/types/contracts";

export const metadata: Metadata = { title: "Home" };

export default function DashboardPage() {
  return (
    <div className="grid gap-12 md:gap-14">
      <section id="start" aria-labelledby="start-heading" className="max-w-3xl scroll-mt-20">
        <PageHeader id="start-heading" title="Start a lesson" description="Paste a lecture you're watching. Sapience splits it into chapters, writes the notes and asks a question after each chapter." />
        <div className="enter mt-6 [--i:1]">
          <Suspense fallback={<div aria-hidden className="h-[3.75rem] animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />}>
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
    <PasteBox
      defaultLanguage={parsePreferences(profile?.preferences).language}
      videoLessons={serverEnv().LESSON_BUILD_MODE === "captions" || capabilities().videoLessons}
    />
  );
}
