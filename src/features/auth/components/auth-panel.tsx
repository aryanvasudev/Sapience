import type { ReactNode } from "react";

import { FullWidthDivider } from "@/components/efferd/full-width-divider";

/**
 * Heading + intro + body for the sign-in and sign-up pages, laid out for the Efferd auth-4 column
 * in (auth)/layout.tsx: the form sits between two full-bleed hairlines.
 */
export function AuthPanel({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col pt-12 md:pt-20">
      <div className="px-6">
        <h1 className="font-serif text-title font-medium">{title}</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">{intro}</p>
      </div>
      <div className="relative mt-10 grid gap-6 px-6 py-8">
        <FullWidthDivider position="top" />
        {children}
        <FullWidthDivider position="bottom" />
      </div>
      {footer ? <div className="grid gap-2 px-6 py-6 text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}

/** From Efferd (@efferd/auth-divider), in sentence case. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground" role="separator">
      <span className="h-px flex-1 bg-border" />
      or continue with email
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div aria-hidden className="grid gap-5">
      <div className="h-12 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="h-11 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="h-11 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="h-12 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
    </div>
  );
}
