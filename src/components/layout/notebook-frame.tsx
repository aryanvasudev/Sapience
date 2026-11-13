import type { ReactNode } from "react";

import { Wordmark } from "@/components/layout/wordmark";
import { cn } from "@/lib/utils";

/**
 * Frame for standalone public pages (privacy, onboarding): the wordmark on a hairline-ruled header
 * and a left-aligned reading column. The name is kept from the earlier notebook design so existing
 * imports keep working.
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
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <Wordmark />
          {headerEnd}
        </div>
      </header>
      <main id="main" className={cn("mx-auto w-full max-w-7xl flex-1 px-4 pb-20 md:px-6", className)}>
        {children}
      </main>
    </div>
  );
}
