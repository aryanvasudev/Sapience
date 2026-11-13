import type { ReactNode } from "react";

import { ThreadsBackdrop } from "@/components/marketing/hero-shader";
import { Reveal } from "@/components/motion/reveal";

/**
 * Closing call to action. Layout from Efferd (https://efferd.com, @efferd/cta-4): a rounded panel
 * with the message centred and the actions under it. Adapted: the React Bits "Threads" shader runs
 * behind it (one lecture in, many threads out), masked so the text sits on calm space.
 */
export function CtaSection({ title, body, actions }: { title: string; body: ReactNode; actions: ReactNode }) {
  return (
    <section aria-labelledby="cta-heading" className="px-4 pb-20 md:px-6 md:pb-28">
      <Reveal className="relative isolate mx-auto w-full max-w-6xl overflow-hidden rounded-[28px] border bg-card px-6 py-20 text-center md:py-28 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]">
        <ThreadsBackdrop className="-z-10 [mask-image:radial-gradient(ellipse_70%_80%_at_50%_100%,black,transparent)]" />
        <h2 id="cta-heading" className="mx-auto max-w-[22ch] text-heading font-semibold">
          {title}
        </h2>
        <p className="mx-auto mt-5 max-w-[32rem] text-[1.0625rem] leading-relaxed text-muted-foreground">{body}</p>
        <div className="mt-9 flex flex-wrap items-start justify-center gap-3">{actions}</div>
      </Reveal>
    </section>
  );
}
