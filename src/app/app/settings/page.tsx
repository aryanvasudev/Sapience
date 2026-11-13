import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { AccountSection, DataSection } from "@/features/settings/components/account-section";
import { AiKeySection } from "@/features/settings/components/ai-key-section";
import { PreferencesForm } from "@/features/settings/components/preferences-form";
import { byokEnabled, keyStatus } from "@/lib/ai/byok";
import { chainsForKeyCheck } from "@/lib/ai/provider";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parsePreferences } from "@/types/contracts";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="grid gap-10">
      <PageHeader title="Settings" description="How Sapience teaches you, your account and your data." />
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsLoader />
      </Suspense>
    </div>
  );
}

async function SettingsLoader() {
  const user = await requireUser("/app/settings");
  const supabase = await createClient();
  const [{ data: profile }, aiKey] = await Promise.all([
    supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle(),
    keyStatus(user.id),
  ]);

  return (
    <div className="enter grid max-w-3xl gap-6 [--i:1]">
      <PreferencesForm initial={parsePreferences(profile?.preferences)} />
      {byokEnabled() ? (
        <AiKeySection initial={aiKey} openRouterAvailable={chainsForKeyCheck("openrouter").text.length > 0} />
      ) : null}
      <AccountSection email={user.email} isAnonymous={user.isAnonymous} />
      <DataSection />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div aria-hidden className="grid max-w-3xl gap-6">
      <div className="h-[30rem] animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      <div className="h-40 animate-pulse rounded-2xl bg-muted/70 motion-reduce:animate-none" />
    </div>
  );
}
