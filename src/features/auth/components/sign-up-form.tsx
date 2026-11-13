"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { MarkEmailReadIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CaptchaError, useTurnstile } from "@/hooks/use-turnstile";

import { signUpWithPassword } from "../actions";
import { SignUpSchema, type SignUpInput } from "../schemas";
import { FormField } from "./form-field";

export function SignUpForm({ isGuest }: { isGuest: boolean }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const { enabled: captchaEnabled, setContainer: setCaptchaContainer, getToken: getCaptchaToken } = useTurnstile();
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const form = useForm<SignUpInput>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: { email: "", password: "" },
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
      const result = await signUpWithPassword({ ...values, captchaToken });
      if (!result.ok) setFormError(result.message);
      else if (result.message) setSentMessage(result.message);
    });
  });

  if (sentMessage) {
    return (
      <div role="status" className="grid gap-3 rounded-lg border bg-card p-5">
        <MarkEmailReadIcon className="size-4.5 text-primary" />
        <p className="text-[0.9375rem] leading-relaxed">{sentMessage}</p>
      </div>
    );
  }

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
      <FormField
        id="password"
        label="Password"
        error={errors.password?.message}
        hint="At least 8 characters."
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "password-error" : "password-hint"}
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
        {pending ? "Creating your account…" : isGuest ? "Create account and keep progress" : "Create account"}
      </Button>
    </form>
  );
}
