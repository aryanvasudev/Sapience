import Link from "next/link";

import { MenuBookIcon, PlayCircleIcon } from "@/components/icons";
import { AiLabel } from "@/components/shared/ai-label";

/**
 * Honest-AI section: what a tutor answer looks like, with the sources it shows and the AI label.
 * The example continues the polymer lecture from the hero preview and is labelled as an example.
 */
export function SourcesSection() {
  return (
    <section aria-labelledby="sources-heading" className="py-20 md:py-28">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-20">
        <div className="max-w-[34rem]">
          <h2 id="sources-heading" className="font-serif text-heading font-medium">
            Every answer shows what it was based on
          </h2>
          <p className="mt-5 text-[1.0625rem] leading-relaxed text-muted-foreground">
            Notes are marked as AI-generated. Each tutor answer lists its sources: the video clip it looked at, the
            lecture’s own words, or general knowledge. You can always check the moment it came from.
          </p>
          <p className="mt-6 text-[0.9375rem] text-muted-foreground">
            Sapience uses the official YouTube player and never downloads videos.{" "}
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center font-medium text-foreground underline decoration-foreground/30 underline-offset-4 transition-[text-decoration-color] duration-150 ease-(--ease-out) md:min-h-0 [@media(hover:hover)]:hover:decoration-foreground"
            >
              What the AI receives
            </Link>
          </p>
        </div>

        <figure className="rounded-[18px] border bg-card p-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-20px_rgb(0_0_0/0.18)] dark:shadow-none">
          <figcaption className="px-3 pt-2 pb-3 text-xs text-muted-foreground">Example tutor answer</figcaption>
          <div className="rounded-[10px] border bg-background p-4 md:p-5">
            <p className="ml-auto w-fit max-w-[85%] rounded-[10px] bg-muted px-3 py-2 text-[0.9375rem]">
              Why divide by the repeat-unit mass?
            </p>
            <ul aria-label="Based on" className="mt-5 flex flex-wrap gap-1.5">
              <SourceChip icon={<PlayCircleIcon className="size-3.5" />}>
                Video <span className="tabular-nums">23:40–27:00</span>
              </SourceChip>
              <SourceChip icon={<MenuBookIcon className="size-3.5" />}>Lecture’s own words</SourceChip>
            </ul>
            <p className="mt-3 font-serif text-[0.9688rem] leading-relaxed">
              M<sub>n</sub> is the mass of an average chain, and every repeat unit adds M<sub>0</sub> = 28 g/mol to
              it. Dividing one by the other counts the repeat units in that chain: 28,000 ÷ 28 = 1,000.
            </p>
            <AiLabel className="mt-4" />
          </div>
        </figure>
      </div>
    </section>
  );
}

function SourceChip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-card px-2 text-xs text-muted-foreground">
      {icon}
      <span>{children}</span>
    </li>
  );
}
