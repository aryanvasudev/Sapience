import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The Sapience wordmark: the name in Geist beside a small highlighter-yellow diamond. The diamond is
 * the product's one recurring mark: it is also how a chapter's checkpoint question is drawn on the
 * lesson timeline.
 */
export function Wordmark({
  href = "/",
  className,
  compact = false,
}: {
  href?: string;
  className?: string;
  /** Below `sm`, show only the diamond (the name stays for screen readers). */
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center gap-2.5 rounded-md text-[1.0625rem] leading-none font-semibold tracking-[-0.02em] text-foreground",
        className,
      )}
    >
      <LogoMark className={cn(compact && "max-sm:size-5")} />
      <span className={cn(compact && "max-sm:sr-only")}>Sapience</span>
    </Link>
  );
}

/** The logo tile: the yellow checkpoint diamond on a slate square, the same in both themes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-[7px] bg-[#151517] shadow-[inset_0_1px_0_rgb(255_255_255/0.1)] ring-1 ring-black/10 dark:ring-white/10",
        className,
      )}
    >
      <span className="size-[40%] rotate-45 rounded-[2px] bg-[#f5cf4a]" />
    </span>
  );
}

/** The checkpoint diamond. Decorative; the surrounding text always says what it marks. */
export function CheckpointMark({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block shrink-0 rotate-45 rounded-[2px] bg-brand", className)} />;
}
