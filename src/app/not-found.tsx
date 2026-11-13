import type { Metadata } from "next";
import Link from "next/link";

import { FullWidthDivider } from "@/components/efferd/full-width-divider";
import { ArrowBackIcon } from "@/components/icons";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Page not found" };

/**
 * 404. Layout from Efferd (https://efferd.com, @efferd/not-found-1): a bordered column with
 * full-bleed hairlines above and below the message. Copy says what happened and where to go.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-4 md:px-8">
        <Wordmark />
      </header>
      <main id="main" className="flex flex-1 items-center justify-center overflow-hidden px-4 pb-16">
        <div className="relative w-full max-w-xl border-x">
          <FullWidthDivider position="top" className="bg-border" />
          <Empty className="enter gap-8 px-6 py-16">
            <EmptyHeader className="max-w-md gap-4">
              <EmptyTitle className="font-mono text-7xl leading-none font-medium tracking-[-0.06em] tabular-nums md:text-8xl">
                404
              </EmptyTitle>
              <EmptyDescription className="text-[0.9375rem] text-muted-foreground">
                There’s no page at this address. If you followed a lesson link, the video in it may have been mistyped.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href="/">
                    <ArrowBackIcon data-icon="inline-start" />
                    Go to the home page
                  </Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/app">Open your lessons</Link>
                </Button>
              </div>
            </EmptyContent>
          </Empty>
          <FullWidthDivider position="bottom" className="bg-border" />
        </div>
      </main>
    </div>
  );
}
