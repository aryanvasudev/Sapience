import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccountSection, DataSection } from "@/features/settings/components/account-section";
import { PreferencesForm } from "@/features/settings/components/preferences-form";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parsePreferences } from "@/types/contracts";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="grid max-w-2xl gap-12">
      <header className="grid gap-2">
        <h1 className="font-serif text-title font-medium">Settings</h1>
      </header>
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />}>
        <SettingsLoader />
      </Suspense>
    </div>
  );
}

async function SettingsLoader() {
  const user = await requireUser("/app/settings");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();

  return (
    <>
      <Section id="preferences" title="Learning preferences">
        <PreferencesForm initial={parsePreferences(profile?.preferences)} />
      </Section>
      <Section id="account" title="Account">
        <AccountSection email={user.email} isAnonymous={user.isAnonymous} />
      </Section>
      <Section id="data" title="Your data">
        <p className="mb-6 text-sm text-muted-foreground">
          What the AI receives, and what Sapience keeps, is explained on the{" "}
          <Link href="/privacy" className="text-foreground underline decoration-foreground/30 underline-offset-4">
            privacy page
          </Link>
          .
        </p>
        <DataSection />
      </Section>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="grid gap-5 border-t pt-8">
      <h2 id={`${id}-heading`} className="font-serif text-xl font-medium">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}
