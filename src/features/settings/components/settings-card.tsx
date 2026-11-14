import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Settings layout (Efferd settings-2): each group is one card with a title row, hairline-separated
 * rows (label left, control right from md up) and an optional footer strip for its action.
 */
export function SettingsCard({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn(
        "scroll-mt-20 overflow-hidden rounded-2xl border bg-card dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]",
        className,
      )}
    >
      <header className="grid gap-1 border-b px-5 py-4">
        <h2 id={`${id}-heading`} className="text-[0.9375rem] font-medium">
          {title}
        </h2>
        {description ? <div className="text-[0.8125rem] leading-relaxed text-muted-foreground">{description}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** Rows inside a card, separated by hairlines. */
export function SettingsRows({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y", className)}>{children}</div>;
}

/** One setting: label and one line of help on the left, the control on the right (stacked on phones). */
export function SettingsRow({
  label,
  labelId,
  htmlFor,
  description,
  descriptionId,
  children,
  className,
}: {
  label: ReactNode;
  /** Id for the label text, for controls named with aria-labelledby (radio groups). */
  labelId?: string;
  /** Renders the label as a <label> for this control id. */
  htmlFor?: string;
  description?: ReactNode;
  descriptionId?: string;
  children?: ReactNode;
  className?: string;
}) {
  const labelClass = "text-sm font-medium";
  return (
    <div
      className={cn(
        "grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-center md:gap-8",
        className,
      )}
    >
      <div className="grid gap-0.5">
        {htmlFor ? (
          <label id={labelId} htmlFor={htmlFor} className={labelClass}>
            {label}
          </label>
        ) : (
          <p id={labelId} className={labelClass}>
            {label}
          </p>
        )}
        {description ? (
          <p id={descriptionId} className="text-[0.8125rem] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="min-w-0">{children}</div> : null}
    </div>
  );
}

/** Footer strip holding the card's action, aligned right; a status message sits on its left. */
export function SettingsFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-14 flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t bg-surface/50 px-5 py-3", className)}>
      {children}
    </div>
  );
}

/** Result line from a server action: quiet when it worked, destructive when it didn't. */
export function SettingsResultText({ result, className }: { result: { ok: boolean; message: string } | null; className?: string }) {
  if (!result) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      className={cn("animate-fade text-[0.8125rem]", result.ok ? "text-muted-foreground" : "text-destructive", className)}
    >
      {result.message}
    </p>
  );
}
