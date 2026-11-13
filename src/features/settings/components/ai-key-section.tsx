"use client";

import { useId, useState, useTransition } from "react";

import { KeyIcon } from "@/components/icons";
import { MorphText } from "@/components/motion/morph-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { removeAiKey, saveAiKey, type AiKeyResult, type SettingsResult } from "../actions";
import { SettingsCard, SettingsFooter, SettingsResultText, SettingsRow, SettingsRows } from "./settings-card";
import { Segmented } from "./settings-controls";

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
    <SettingsCard
      id="ai-key"
      title="Your own AI key"
      description="Sapience runs on shared free AI capacity with daily limits. Add your own free key and your lessons, tutor and search use it instead, with no daily limit from Sapience. Lessons you build are still shared with other students. The key is stored encrypted and never shown again."
    >
      <form
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
        <SettingsRows>
          {status ? (
            <SettingsRow
              label="Key in use"
              className="grid-cols-[minmax(0,1fr)_auto] items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]"
              description={
                <span className="inline-flex items-center gap-1.5">
                  <KeyIcon className="size-4 shrink-0 text-faint" />
                  <span>
                    {PROVIDER_NAME[status.provider]} key ending{" "}
                    <span className="font-mono text-foreground">{status.last4}</span>
                  </span>
                </span>
              }
            >
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
            </SettingsRow>
          ) : null}

          {openRouterAvailable ? (
            <SettingsRow label="Provider" labelId={`${id}-provider-label`}>
              <Segmented
                labelledBy={`${id}-provider-label`}
                name={`${id}-provider`}
                options={[
                  { value: "gemini" as const, label: "Gemini" },
                  { value: "openrouter" as const, label: "OpenRouter" },
                ]}
                value={provider}
                onChange={setProvider}
              />
            </SettingsRow>
          ) : null}

          <SettingsRow
            label={status ? "Replace with a new key" : `${PROVIDER_NAME[provider]} API key`}
            htmlFor={`${id}-key`}
            descriptionId={`${id}-where`}
            description={
              <>
                <a
                  href={WHERE[provider].href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:decoration-foreground"
                >
                  {WHERE[provider].label}
                </a>
                . Sapience makes one tiny test call before saving it.
              </>
            }
          >
            <Input
              id={`${id}-key`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              maxLength={400}
              aria-describedby={`${id}-where`}
              className="rounded-[10px] font-mono"
            />
          </SettingsRow>
        </SettingsRows>

        <SettingsFooter>
          <SettingsResultText result={result} className="mr-auto" />
          <Button type="submit" disabled={pending || apiKey.trim().length < 20}>
            <MorphText>{pending ? "Checking…" : "Check and save"}</MorphText>
          </Button>
        </SettingsFooter>
      </form>
    </SettingsCard>
  );
}
