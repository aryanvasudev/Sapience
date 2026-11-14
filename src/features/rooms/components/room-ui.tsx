import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { initials } from "@/lib/rooms/code";
import { cn } from "@/lib/utils";

/** Initials in a graphite disc. `active` adds the yellow "studying now" dot. */
export function MemberAvatar({
  name,
  active = false,
  size = "md",
  className,
}: {
  name: string;
  active?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full bg-raised font-medium text-muted-foreground ring-1 ring-border",
        size === "sm" ? "size-6 text-[0.625rem]" : "size-8 text-[0.6875rem]",
        className,
      )}
    >
      {initials(name)}
      {active ? (
        <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-brand shadow-[0_0_0_2px_var(--background)]" />
      ) : null}
    </span>
  );
}

/** A labelled form field with an optional hint. */
export function Field({ id, label, hint, children }: { id: string; label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="animate-fade text-sm text-destructive">
      {message}
    </p>
  ) : null;
}
