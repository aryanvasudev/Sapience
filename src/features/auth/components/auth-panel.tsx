import type { ReactNode } from "react";

/**
 * Heading + intro + body for the sign-in and sign-up pages, laid out for the Efferd auth-2 form
 * column in (auth)/layout.tsx. The block carries the page's one entrance.
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
    <div className="flex flex-1 flex-col justify-center py-10">
      <div className="enter">
        <h1 className="text-title font-semibold">{title}</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">{intro}</p>
      </div>
      <div className="enter mt-8 grid gap-5 [--i:1]">{children}</div>
      {footer ? <div className="enter mt-8 grid gap-2 border-t pt-6 text-sm text-muted-foreground [--i:2]">{footer}</div> : null}
    </div>
  );
}

/** From Efferd (@efferd/auth-divider), in sentence case. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-faint" role="separator">
      <span className="h-px flex-1 bg-border" />
      or continue with email
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div aria-hidden className="grid gap-5">
      <div className="h-11 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="h-10 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="h-10 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="h-11 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
    </div>
  );
}
