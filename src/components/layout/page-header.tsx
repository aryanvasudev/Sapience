import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Title block that opens every signed-in page: title, one line of context, and actions on the right.
 * It carries the page's single entrance (fade, rise and sharpen), so the rest can stay still.
 */
export function PageHeader({
  title,
  description,
  actions,
  id,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <header className={cn("enter flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0 max-w-[44rem]">
        <h1 id={id} className="text-title font-semibold">
          {title}
        </h1>
        {description ? <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Section heading inside a page: a quiet label with optional meta or action on the right. */
export function SectionHeading({
  id,
  children,
  meta,
  className,
}: {
  id?: string;
  children: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <h2 id={id} className="text-[0.9375rem] font-medium">
        {children}
      </h2>
      {meta ? <div className="text-[0.8125rem] text-muted-foreground">{meta}</div> : null}
    </div>
  );
}
