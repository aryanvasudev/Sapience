import type { ReactNode } from "react";

import { CheckCircleIcon, MenuBookIcon, PlayCircleIcon, SupportIcon } from "@/components/icons";
import { CheckpointMark } from "@/components/layout/wordmark";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

/**
 * "While you watch". Layout from Efferd (https://efferd.com, @efferd/features-6, bento grid) with
 * the corner marks of @efferd/features-4. Adapted: every cell shows a small, real piece of a
 * lesson instead of an icon, built in code with example content from the polymer lecture used
 * across the page. Copy describes what a lesson actually does.
 */
export function FeatureSection() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 pt-28 md:pt-40">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <Reveal className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end md:gap-12">
          <h2 id="how-heading" className="text-heading font-semibold">
            While you watch
          </h2>
          <p className="max-w-[30rem] text-[1.0625rem] leading-relaxed text-muted-foreground md:justify-self-end">
            Paste the link once. The lecture plays in YouTube’s own player, and the lesson works alongside it.
          </p>
        </Reveal>

        <ul className="mt-12 grid gap-3 md:grid-cols-6 md:gap-4">
          <Cell
            className="md:col-span-4"
            title="It checks you understood"
            body="At the end of each chapter the video pauses for one question about what was just taught."
            visual={<CheckpointVisual />}
          />
          <Cell
            className="md:col-span-2"
            delay={0.06}
            title="It explains the last two minutes again"
            body="Tap “I’m lost” and the tutor re-explains the moment you’re at, in your lecturer’s own terms."
            visual={<LostVisual />}
          />
          <Cell
            className="md:col-span-2"
            title="It writes the notes"
            body="Chapter notes, formulas and key moments, each linked to the second in the video where it was said."
            visual={<NotesVisual />}
          />
          <Cell
            className="md:col-span-4"
            delay={0.06}
            title="It brings back what you missed"
            body="Questions you got wrong come back for revision on a spaced schedule, before the exam rather than the night before."
            visual={<RevisionVisual />}
          />
        </ul>
      </div>
    </section>
  );
}

function Cell({
  title,
  body,
  visual,
  className,
  delay = 0,
}: {
  title: string;
  body: string;
  visual: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal
      as="li"
      delay={delay}
      className={cn(
        "group/cell relative flex flex-col overflow-hidden rounded-2xl border bg-card dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]",
        className,
      )}
    >
      <div aria-hidden className="relative h-52 overflow-hidden border-b bg-surface/60 [mask-image:linear-gradient(to_bottom,black_70%,transparent)] md:h-56">
        <div className="bg-hairline-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="relative flex h-full items-center justify-center p-6">{visual}</div>
      </div>
      <div className="p-6 pt-5">
        <h3 className="text-[1.0625rem] font-medium tracking-[-0.01em]">{title}</h3>
        <p className="mt-2 max-w-[34rem] text-[0.9375rem] leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </Reveal>
  );
}

/* ---------- Visuals: example content, decorative (aria-hidden on the container) ---------- */

function CheckpointVisual() {
  const chapters = [12, 19, 25, 25, 19];
  return (
    <div className="grid w-full max-w-[34rem] gap-5">
      <div className="flex h-2 gap-1">
        {chapters.map((w, i) => (
          <span key={i} className="relative rounded-full bg-muted" style={{ width: `${w}%` }}>
            {i < 2 ? <span className="absolute inset-0 rounded-full bg-foreground/35" /> : null}
            <span
              className={cn(
                "absolute top-1/2 -right-[5px] size-2.5 -translate-y-1/2 rotate-45 rounded-[2px] shadow-[0_0_0_3px_var(--surface)]",
                i < 3 ? "bg-brand" : "bg-foreground/25",
              )}
            />
          </span>
        ))}
      </div>
      <div className="mx-auto w-full max-w-[22rem] rounded-xl border bg-card p-4 shadow-[0_16px_40px_-20px_rgb(0_0_0/0.5)] transition-transform duration-500 ease-(--ease-out) group-hover/cell:-translate-y-1">
        <p className="flex items-center gap-2 text-[0.75rem] text-muted-foreground">
          <CheckpointMark className="size-2" />
          Checkpoint · chapter 3
        </p>
        <p className="mt-2 text-[0.8125rem] leading-snug">What does the degree of polymerization count?</p>
        <div className="mt-3 grid gap-1.5 text-[0.75rem]">
          <span className="flex h-8 items-center justify-between rounded-lg border border-positive/50 bg-positive/10 px-2.5">
            Repeat units in an average chain
            <CheckCircleIcon className="size-3.5 text-positive" />
          </span>
          <span className="flex h-8 items-center rounded-lg border bg-background px-2.5 text-faint">Chains in the sample</span>
        </div>
      </div>
    </div>
  );
}

function LostVisual() {
  return (
    <div className="grid w-full max-w-[17rem] gap-2.5">
      <span className="inline-flex h-8 w-fit items-center gap-1.5 justify-self-end rounded-full border bg-card px-3 text-[0.75rem] font-medium shadow-sm">
        <SupportIcon className="size-3.5 text-brand-ink" />
        I’m lost
      </span>
      <div className="rounded-xl border bg-card p-3 text-[0.75rem] leading-relaxed shadow-[0_16px_40px_-20px_rgb(0_0_0/0.5)] transition-transform duration-500 ease-(--ease-out) group-hover/cell:-translate-y-1">
        <span className="mb-2 flex gap-1">
          <span className="inline-flex h-5 items-center gap-1 rounded-[5px] border bg-surface px-1.5 font-mono text-[0.625rem] text-muted-foreground">
            <PlayCircleIcon className="size-3" />
            21:40–23:40
          </span>
        </span>
        Think of one chain as a train. M<sub>n</sub> is the whole train’s mass, M<sub>0</sub> one carriage. Divide, and
        you get the carriages.
      </div>
    </div>
  );
}

function NotesVisual() {
  const lines = [
    { t: "15:42", w: "w-[85%]" },
    { t: "18:10", w: "w-[70%]" },
    { t: "21:05", w: "w-[78%]" },
  ];
  return (
    <div className="w-full max-w-[17rem] rounded-xl border bg-card p-4 shadow-[0_16px_40px_-20px_rgb(0_0_0/0.5)] transition-transform duration-500 ease-(--ease-out) group-hover/cell:-translate-y-1">
      <p className="flex items-center gap-1.5 text-[0.75rem] font-medium">
        <MenuBookIcon className="size-3.5 text-faint" />
        Degree of polymerization
      </p>
      <p className="mt-3 rounded-md border bg-surface py-1.5 text-center font-mono text-[0.8125rem]">DP = Mₙ / M₀</p>
      <ul className="mt-3 grid gap-2">
        {lines.map((l) => (
          <li key={l.t} className="flex items-center gap-2">
            <span className="rounded-[4px] border bg-surface px-1 font-mono text-[0.625rem] text-muted-foreground">{l.t}</span>
            <span className={cn("h-1.5 rounded-full bg-foreground/15", l.w)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RevisionVisual() {
  const days = [
    { label: "Today", due: true },
    { label: "Tue", due: false },
    { label: "Wed", due: true },
    { label: "Thu", due: false },
    { label: "Fri", due: false },
    { label: "Sat", due: false },
    { label: "Sun", due: true },
    { label: "Mon", due: false },
    { label: "Tue", due: false },
    { label: "Wed", due: false },
    { label: "Thu", due: true },
  ];
  return (
    <div className="grid w-full max-w-[36rem] gap-4">
      <div className="grid grid-cols-11 gap-1.5">
        {days.map((d, i) => (
          <div key={i} className="grid justify-items-center gap-2">
            <span
              className={cn(
                "grid h-16 w-full place-items-center rounded-lg border",
                i === 0 ? "border-brand/50 bg-brand/10" : "bg-card",
              )}
            >
              {d.due ? <CheckpointMark className={cn("size-2.5", i === 0 ? "" : "bg-foreground/30")} /> : null}
            </span>
            <span className={cn("font-mono text-[0.625rem]", i === 0 ? "text-foreground" : "text-faint")}>{d.label}</span>
          </div>
        ))}
      </div>
      <p className="flex items-center justify-between gap-3 text-[0.75rem] text-muted-foreground">
        <span>Monomers vs repeat units</span>
        <span className="font-mono text-faint">Next review in 3 days</span>
      </p>
    </div>
  );
}
