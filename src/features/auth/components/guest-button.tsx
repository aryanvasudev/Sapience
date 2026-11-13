"use client";

import { useState, useTransition } from "react";

import { MorphText } from "@/components/motion/morph-text";
import { Button } from "@/components/ui/button";
import { CaptchaError, useTurnstile } from "@/hooks/use-turnstile";
import { cn } from "@/lib/utils";

import { signInAsGuest } from "../actions";

/**
 * "Try without an account" (Supabase anonymous sign-in), with a Turnstile token when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 */
export function GuestButton({
  label = "Try without an account",
  variant = "default",
  className,
  buttonClassName,
}: {
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
  /** Classes for the button itself; `className` styles the wrapper that also holds the error. */
  buttonClassName?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { enabled: captchaEnabled, setContainer: setCaptchaContainer, getToken: getCaptchaToken } = useTurnstile();

  return (
    <div className={cn("grid gap-2", className)}>
      <Button
        type="button"
        size={variant === "link" ? "default" : "lg"}
        variant={variant}
        className={buttonClassName}
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              // Keep a shared lesson link working: /login?next=/app/lesson/… returns there.
              const next = new URLSearchParams(window.location.search).get("next") ?? undefined;
              const result = await signInAsGuest(await getCaptchaToken(), next);
              if (!result.ok) setError(result.message);
            } catch (e) {
              if (e instanceof CaptchaError) setError(e.message);
              else throw e;
            }
          });
        }}
      >
        <MorphText>{pending ? "Starting…" : label}</MorphText>
      </Button>
      {captchaEnabled ? <div ref={setCaptchaContainer} className="empty:hidden" /> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
