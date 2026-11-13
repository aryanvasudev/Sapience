import type { ComponentType } from "react";

import { FullWidthDivider } from "@/components/efferd/full-width-divider";
import { BookmarkAddedIcon, EditNoteIcon, PauseCircleIcon, SupportIcon } from "@/components/icons";

/**
 * "While you watch". Layout from Efferd (https://efferd.com, @efferd/features-3): a hairline grid
 * between full-bleed dividers. Adapted: Material Symbols in the muted text colour instead of
 * coloured icons, serif titles, and copy that describes what a lesson actually does.
 */
type Feature = { icon: ComponentType<{ className?: string }>; title: string; body: string };

const FEATURES: Feature[] = [
  {
    icon: PauseCircleIcon,
    title: "It checks you understood",
    body: "At the end of each chapter the video pauses for one question about what was just taught.",
  },
  {
    icon: SupportIcon,
    title: "It explains the last two minutes again",
    body: "Tap “I’m lost” and the tutor re-explains the moment you’re at, in your lecturer’s own terms and notation.",
  },
  {
    icon: EditNoteIcon,
    title: "It writes the notes",
    body: "Chapter notes, formulas and key moments, each linked to the second in the video where it was said.",
  },
  {
    icon: BookmarkAddedIcon,
    title: "It brings back what you missed",
    body: "Questions you got wrong come back for revision on a spaced schedule, before the exam rather than the night before.",
  },
];

export function FeatureSection() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 pt-20 md:pt-28">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="max-w-[38rem]">
          <h2 id="how-heading" className="font-serif text-heading font-medium">
            While you watch
          </h2>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground">
            Paste the link once. The lecture plays in YouTube’s own player, and the lesson works alongside it.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-12 w-full max-w-7xl md:px-6">
        <div className="relative md:border-x">
          <FullWidthDivider position="top" />
          <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col gap-3 bg-background px-4 py-8 md:px-6 md:py-10">
              <Icon className="size-4.5 text-muted-foreground" />
              <dt className="mt-5 font-serif text-[1.1875rem] leading-snug font-medium tracking-[-0.005em]">{title}</dt>
              <dd className="text-[0.9375rem] leading-relaxed text-muted-foreground">{body}</dd>
            </div>
          ))}
          </dl>
          <FullWidthDivider position="bottom" />
        </div>
      </div>
    </section>
  );
}
