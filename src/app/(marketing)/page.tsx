import Link from "next/link";
import { Suspense } from "react";

import { CtaSection } from "@/components/efferd/cta-section";
import { FaqsSection } from "@/components/efferd/faqs-section";
import { FeatureSection } from "@/components/efferd/feature-section";
import { SiteFooter } from "@/components/efferd/site-footer";
import { SiteHeader } from "@/components/efferd/site-header";
import { ArrowForwardIcon } from "@/components/icons";
import { CheckpointMark } from "@/components/layout/wordmark";
import { HeroWaves } from "@/components/marketing/hero-shader";
import { LessonPreview } from "@/components/marketing/lesson-preview";
import { ScrollScale } from "@/components/marketing/scroll-scale";
import { SourcesSection } from "@/components/marketing/sources-section";
import { Button } from "@/components/ui/button";
import { GuestButton } from "@/features/auth/components/guest-button";
import { getCurrentUser } from "@/lib/auth";

export default function LandingPage() {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip">
      <SiteHeader
        actions={
          <Suspense fallback={<SignedOutActions />}>
            <HeaderActions />
          </Suspense>
        }
      />

      <main id="main" className="flex-1">
        {/* Hero: fills the first screen; dark swells roll along its bottom edge, their crests catching the accent. */}
        <section aria-labelledby="hero-heading" className="relative -mt-16">
          <div className="relative flex min-h-svh flex-col pt-16">
            <HeroWaves className="-z-10 top-auto h-[62%] [mask-image:linear-gradient(to_bottom,transparent,black_40%,black_78%,transparent)]" />

            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 pt-12 pb-[20svh] text-center md:px-6">
              <p className="enter inline-flex items-center gap-2 text-[0.8125rem] text-foreground/70">
                <CheckpointMark className="size-2" />
                For lectures in English, Hindi and Hinglish
              </p>
              <h1 id="hero-heading" className="enter mt-6 max-w-[15ch] text-display font-semibold [--i:1] sm:max-w-[18ch]">
                Any YouTube lecture, turned into an interactive lesson
              </h1>
              <p className="enter mt-6 max-w-[36rem] text-[1.0625rem] leading-relaxed text-foreground/75 [--i:2] md:text-lg">
                Paste a link to a lecture you’re already watching. Sapience splits it into chapters, writes the notes,
                pauses for a question after each chapter, and answers your doubts from what the lecturer said.
              </p>
              <div className="enter mt-9 flex flex-wrap items-start justify-center gap-3 [--i:3]">
                <Suspense fallback={<GuestButton />}>
                  <PrimaryAction />
                </Suspense>
                <Button asChild size="lg" variant="outline">
                  <Link href="/signup">Create an account</Link>
                </Button>
              </div>
            </div>
          </div>

          {/* The demo peeks over the waves at the bottom of the first screen, then grows to full size as you scroll. */}
          <ScrollScale className="enter relative mx-auto -mt-[14svh] w-full max-w-6xl px-4 [--i:5] md:px-6">
            <LessonPreview />
          </ScrollScale>
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
      <Link
        href="/login"
        className="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:text-foreground"
      >
        Sign in
      </Link>
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
      <Link href="/app">
        Open your lessons
        <ArrowForwardIcon data-icon="inline-end" />
      </Link>
    </Button>
  );
}

async function PrimaryAction() {
  const user = await getCurrentUser();
  if (!user) return <GuestButton />;
  return (
    <Button asChild size="lg">
      <Link href="/app">
        Open your lessons
        <ArrowForwardIcon data-icon="inline-end" />
      </Link>
    </Button>
  );
}
