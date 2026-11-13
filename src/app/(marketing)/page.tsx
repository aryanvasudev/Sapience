import Link from "next/link";
import { Suspense } from "react";

import { CtaSection } from "@/components/efferd/cta-section";
import { FaqsSection } from "@/components/efferd/faqs-section";
import { FeatureSection } from "@/components/efferd/feature-section";
import { SiteFooter } from "@/components/efferd/site-footer";
import { SiteHeader } from "@/components/efferd/site-header";
import { HeroShader } from "@/components/marketing/hero-shader";
import { LessonPreview } from "@/components/marketing/lesson-preview";
import { SourcesSection } from "@/components/marketing/sources-section";
import { Button } from "@/components/ui/button";
import { GuestButton } from "@/features/auth/components/guest-button";
import { getCurrentUser } from "@/lib/auth";

export default function LandingPage() {
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      {/* The shader covers the first screen, behind the header and the hero. */}
      <HeroShader className="-z-10 top-[44svh] h-[100svh] lg:top-[18svh] max-h-[60rem] [mask-composite:intersect] [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_62%,transparent),linear-gradient(to_right,rgb(0_0_0/0.35),rgb(0_0_0/0.35)_30%,black_62%)] lg:[mask-image:linear-gradient(to_bottom,transparent,black_30%,black_62%,transparent),linear-gradient(to_right,rgb(0_0_0/0.3),rgb(0_0_0/0.3)_38%,black_58%)]" />

      <SiteHeader
        actions={
          <Suspense fallback={<SignedOutActions />}>
            <HeaderActions />
          </Suspense>
        }
      />

      <main id="main" className="flex-1">
        <section
          aria-labelledby="hero-heading"
          className="mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-7xl items-center gap-12 px-4 pt-10 pb-16 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-16 lg:py-16 xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]"
        >
          <div className="max-w-[40rem]">
            <h1 id="hero-heading" className="font-serif text-display font-medium">
              Any YouTube lecture, turned into an interactive lesson
            </h1>
            <p className="mt-6 max-w-[33rem] text-lg leading-relaxed text-muted-foreground">
              Paste a link to a lecture you’re already watching. Sapience splits it into chapters, writes the notes,
              pauses for a question after each chapter, and answers your doubts from what the lecturer said and wrote
              on the board.
            </p>
            <div className="mt-9 flex flex-wrap items-start gap-3">
              <Suspense fallback={<GuestButton />}>
                <PrimaryAction />
              </Suspense>
              <Button asChild size="lg" variant="outline">
                <Link href="/signup">Create an account</Link>
              </Button>
            </div>
          </div>
          <LessonPreview />
        </section>

        <FeatureSection />
        <SourcesSection />
        <FaqsSection />
        <CtaSection
          title="Start with a lecture you’re watching this week"
          body="Free to use. Try it as a guest, and create an account when you want to keep your progress."
          actions={
            <Suspense fallback={<GuestButton />}>
              <PrimaryAction />
            </Suspense>
          }
        />
      </main>

      <SiteFooter />
    </div>
  );
}

function SignedOutActions() {
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="h-9 px-3">
        <Link href="/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" className="h-9 px-3.5">
        <Link href="/signup">Create an account</Link>
      </Button>
    </>
  );
}

async function HeaderActions() {
  const user = await getCurrentUser();
  if (!user) return <SignedOutActions />;
  return (
    <Button asChild size="sm" className="h-9 px-3.5">
      <Link href="/app">Open your lessons</Link>
    </Button>
  );
}

async function PrimaryAction() {
  const user = await getCurrentUser();
  if (!user) return <GuestButton />;
  return (
    <Button asChild size="lg">
      <Link href="/app">Open your lessons</Link>
    </Button>
  );
}
