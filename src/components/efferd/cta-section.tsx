import type { ReactNode } from "react";

import { FullWidthDivider } from "@/components/efferd/full-width-divider";

/**
 * Closing call to action. Layout from Efferd (https://efferd.com, @efferd/cta-2): a bordered column
 * between full-bleed hairlines, message above and actions on a recessed strip below. The actions are
 * passed in because they depend on the session.
 */
export function CtaSection({ title, body, actions }: { title: string; body: ReactNode; actions: ReactNode }) {
  return (
    <section aria-labelledby="cta-heading" className="px-4 pt-4 pb-16 md:pb-24">
      <div className="relative mx-auto flex w-full max-w-3xl flex-col border-x">
        <FullWidthDivider position="top" />
        <div className="border-b px-6 py-12 text-center md:py-16">
          <h2 id="cta-heading" className="mx-auto max-w-[30rem] font-serif text-heading font-medium">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-[32rem] text-[0.9375rem] leading-relaxed text-muted-foreground">{body}</p>
        </div>
        <div className="flex flex-wrap items-start justify-center gap-3 bg-surface px-4 py-6">{actions}</div>
        <FullWidthDivider position="bottom" />
      </div>
    </section>
  );
}
