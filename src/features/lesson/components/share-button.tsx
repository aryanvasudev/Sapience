"use client";

import { useState } from "react";

import { CheckIcon, ShareIcon } from "@/components/icons";
import { MorphText } from "@/components/motion/morph-text";
import { Button } from "@/components/ui/button";
import type { OutputLanguage } from "@/config/enums";

/**
 * Copy a link to this lesson (Section 3.2, P1). Anyone can open it: signed-out visitors are sent
 * to sign in, where "Try a lesson without an account" brings them straight back to it.
 */
export function ShareButton({ videoId, language }: { videoId: string; language: OutputLanguage }) {
  const [state, setState] = useState<"idle" | "copied" | { manual: string }>("idle");

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          const url = `${window.location.origin}/app/lesson/${videoId}?lang=${language}`;
          try {
            await navigator.clipboard.writeText(url);
            setState("copied");
            window.setTimeout(() => setState("idle"), 2500);
          } catch {
            setState({ manual: url });
          }
        }}
      >
        {state === "copied" ? <CheckIcon className="animate-fade" /> : <ShareIcon />}
        <MorphText>{state === "copied" ? "Link copied" : "Share"}</MorphText>
      </Button>
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? "Link to this lesson copied" : ""}
      </span>
      {typeof state === "object" ? (
        <input
          readOnly
          aria-label="Link to this lesson"
          value={state.manual}
          onFocus={(e) => e.currentTarget.select()}
          className="h-8 min-w-0 flex-1 animate-fade rounded-lg border bg-card px-3 font-mono text-[0.75rem] text-muted-foreground"
        />
      ) : null}
    </>
  );
}
