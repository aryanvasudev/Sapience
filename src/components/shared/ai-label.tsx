import { cn } from "@/lib/utils";

/**
 * Required on every AI-generated block (Section 11). Says what it is, plainly. Hand-written test
 * fixtures are never labelled as AI output.
 */
export function AiLabel({ note, fixture, className }: { note?: string; fixture?: boolean; className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {fixture ? "Test fixture · hand-written, not AI-generated" : `AI-generated · may contain errors${note ? ` · ${note}` : ""}`}
    </p>
  );
}
