"use client";

import { useState } from "react";

import { BookmarkAddedIcon, BookmarkAddIcon, ProgressActivityIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { CreateConceptResponseSchema, type CreateConceptRequest } from "@/types/contracts";

/**
 * Save a concept for spaced revision (Section 5.10). Saving the same thing twice is harmless: the
 * server returns the existing concept. The first review is a day later, and the button says so.
 */
export function SaveConceptButton({
  concept,
  label = "Save for revision",
  size = "sm",
  variant = "outline",
}: {
  concept: CreateConceptRequest;
  label?: string;
  size?: "xs" | "sm";
  variant?: "outline" | "ghost";
}) {
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string }>({ kind: "idle" });

  const save = async () => {
    setState({ kind: "saving" });
    const response = await requestJson("/api/concepts", CreateConceptResponseSchema, { body: concept });
    setState(response.ok ? { kind: "saved" } : { kind: "error", message: response.message });
  };

  if (state.kind === "saved") {
    return (
      <p
        role="status"
        className={cn(
          "inline-flex animate-fade items-center gap-1.5 text-muted-foreground",
          size === "xs" ? "h-6 text-xs" : "h-7 text-[0.8125rem]",
        )}
      >
        <BookmarkAddedIcon className={cn("shrink-0 text-foreground", size === "xs" ? "size-3.5" : "size-4")} />
        Saved · first review tomorrow
      </p>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button type="button" size={size} variant={variant} onClick={() => void save()} disabled={state.kind === "saving"}>
        {state.kind === "saving" ? <ProgressActivityIcon className="animate-spin motion-reduce:animate-none" /> : <BookmarkAddIcon />}
        {label}
      </Button>
      {state.kind === "error" ? (
        <span role="alert" className="animate-fade text-[0.8125rem] text-destructive">
          {state.message}
        </span>
      ) : null}
    </span>
  );
}
