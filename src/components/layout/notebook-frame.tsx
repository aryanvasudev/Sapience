import type { ReactNode } from "react";

import { Wordmark } from "@/components/layout/wordmark";
import { cn } from "@/lib/utils";

/**
 * Frame for standalone public pages (privacy): the wordmark on a hairline-ruled header that stays
 * pinned, and the page's own column below. The name is kept from the earlier notebook design so
 * existing imports keep working.
 */
export function NotebookFrame({
  children,
  headerEnd,
  className,
}: {
  children: ReactNode;
  headerEnd?: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          <Wordmark />
          {headerEnd}
        </div>
      </header>
      <main id="main" className={cn("mx-auto w-full max-w-6xl flex-1 px-4 pb-24 md:px-8", className)}>
        {children}
      </main>
    </div>
  );
}
