"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CaptchaError, useTurnstile } from "@/hooks/use-turnstile";

import { signInWithPassword } from "../actions";
import { SignInSchema, type SignInInput } from "../schemas";
import { FormField } from "./form-field";

export function SignInForm({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const { enabled: captchaEnabled, setContainer: setCaptchaContainer, getToken: getCaptchaToken } = useTurnstile();
  const form = useForm<SignInInput>({
    resolver: zodResolver(SignInSchema),
    defaultValues: { email: "", password: "", next },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      let captchaToken: string | undefined;
      try {
        captchaToken = await getCaptchaToken();
      } catch (e) {
        if (e instanceof CaptchaError) return setFormError(e.message);
        throw e;
      }
      const result = await signInWithPassword({ ...values, captchaToken });
      if (!result.ok) setFormError(result.message);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormField id="email" label="Email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...form.register("email")}
        />
      </FormField>
      <FormField id="password" label="Password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...form.register("password")}
        />
      </FormField>
      {captchaEnabled ? <div ref={setCaptchaContainer} className="empty:hidden" /> : null}
      {formError ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
