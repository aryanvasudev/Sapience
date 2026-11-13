"use client";

import { useId, useState, useTransition } from "react";

import { KeyIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { removeAiKey, saveAiKey, type AiKeyResult, type SettingsResult } from "../actions";

type Provider = "gemini" | "openrouter";
type Status = { provider: Provider; last4: string; validatedAt: string | null };

const PROVIDER_NAME: Record<Provider, string> = { gemini: "Gemini (Google AI Studio)", openrouter: "OpenRouter" };
const WHERE: Record<Provider, { href: string; label: string }> = {
  gemini: { href: "https://aistudio.google.com/apikey", label: "Get a free key from Google AI Studio" },
  openrouter: { href: "https://openrouter.ai/keys", label: "Create a key on OpenRouter" },
};

/**
 * "Use your own AI key" (Section 4.5.4). The key goes to the server once, is checked with one
 * small call and stored encrypted; the page only ever sees the provider and last 4 characters.
 */
export function AiKeySection({ initial, openRouterAvailable }: { initial: Status | null; openRouterAvailable: boolean }) {
  const id = useId();
  const [status, setStatus] = useState<Status | null>(initial);
  const [provider, setProvider] = useState<Provider>(initial?.provider ?? "gemini");
  const [apiKey, setApiKey] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AiKeyResult | SettingsResult | null>(null);

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Sapience runs on shared free AI capacity with daily limits. Add your own free key and your lessons, tutor and search
        use it instead, with no daily limit from Sapience. Lessons you build are still shared with other students. The key is
        stored encrypted and never shown again.
      </p>

      {status ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
          <p className="flex items-center gap-2 text-sm">
            <KeyIcon className="size-4.5 shrink-0 text-muted-foreground" />
            <span>
              {PROVIDER_NAME[status.provider]} key ending <span className="font-mono">{status.last4}</span>
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await removeAiKey();
                setResult(r);
                if (r.ok) setStatus(null);
              })
            }
          >
            Remove
          </Button>
        </div>
      ) : null}

      <form
        className="grid max-w-md gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await saveAiKey({ provider, apiKey });
            setResult(r);
            if (r.ok && "status" in r) {
              setStatus(r.status);
              setApiKey("");
            }
          });
        }}
      >
        {openRouterAvailable ? (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Provider</legend>
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
              {(["gemini", "openrouter"] as const).map((p) => (
                <label
                  key={p}
                  className="inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-[color,background-color,box-shadow] duration-150 ease-(--ease-out) has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring [@media(hover:hover)]:hover:text-foreground"
                >
                  <input
                    type="radio"
                    name={`${id}-provider`}
                    value={p}
                    checked={provider === p}
                    onChange={() => setProvider(p)}
                    className="sr-only"
                  />
                  {p === "gemini" ? "Gemini" : "OpenRouter"}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <div className="grid gap-2">
          <label htmlFor={`${id}-key`} className="text-sm font-medium">
            {status ? "Replace with a new key" : `${PROVIDER_NAME[provider]} API key`}
          </label>
          <div className="flex gap-2">
            <Input
              id={`${id}-key`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              maxLength={400}
              aria-describedby={`${id}-where`}
            />
            <Button type="submit" variant="outline" disabled={pending || apiKey.trim().length < 20}>
              {pending ? "Checking…" : "Check and save"}
            </Button>
          </div>
          <p id={`${id}-where`} className="text-sm text-muted-foreground">
            <a
              href={WHERE[provider].href}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline decoration-foreground/30 underline-offset-4"
            >
              {WHERE[provider].label}
            </a>
            . Sapience makes one tiny test call before saving it.
          </p>
        </div>
      </form>

      {result ? (
        <p role={result.ok ? "status" : "alert"} className={cn("text-sm", result.ok ? "text-muted-foreground" : "text-destructive")}>
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
