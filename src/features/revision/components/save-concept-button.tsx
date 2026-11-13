"use client";

import { useState } from "react";

import { BookmarkAddedIcon, BookmarkAddIcon, ProgressActivityIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/client-api";
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
      <p role="status" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <BookmarkAddedIcon className="size-4.5 text-foreground" />
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
        <span role="alert" className="text-sm text-destructive">
          {state.message}
        </span>
      ) : null}
    </span>
  );
}
