import type { Metadata } from "next";
import Link from "next/link";

import { FullWidthDivider } from "@/components/efferd/full-width-divider";
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
      <header className="px-4 py-5 md:px-10">
        <Wordmark />
      </header>
      <main className="flex flex-1 items-center justify-center overflow-hidden px-4 pb-16">
        <div className="relative w-full max-w-xl border-x border-foreground/10">
          <FullWidthDivider position="top" />
          <Empty className="gap-6 px-6 py-14">
            <EmptyHeader className="max-w-md gap-3">
              <EmptyTitle className="font-serif text-7xl font-medium tracking-[-0.03em] tabular-nums md:text-8xl">
                404
              </EmptyTitle>
              <EmptyDescription className="text-[0.9375rem]">
                There’s no page at this address. If you followed a lesson link, the video in it may have been mistyped.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link href="/app">Open your lessons</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/">Go to the home page</Link>
                </Button>
              </div>
            </EmptyContent>
          </Empty>
          <FullWidthDivider position="bottom" />
        </div>
      </main>
    </div>
  );
}
