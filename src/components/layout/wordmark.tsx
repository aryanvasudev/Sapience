import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The Sapience wordmark: the name in Literata beside a small sapphire diamond. The diamond is the
 * product's one recurring mark: it is also how a chapter's checkpoint question is drawn on the
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
        "inline-flex min-h-11 min-w-11 items-center gap-2.5 rounded-md font-serif text-[1.1875rem] leading-none font-medium tracking-[-0.01em] text-foreground",
        className,
      )}
    >
      <CheckpointMark className={cn("size-2.5", compact && "max-sm:size-3")} />
      <span className={cn(compact && "max-sm:sr-only")}>Sapience</span>
    </Link>
  );
}

/** The checkpoint diamond. Decorative; the surrounding text always says what it marks. */
export function CheckpointMark({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block shrink-0 rotate-45 rounded-[2px] bg-sapphire", className)} />;
}
