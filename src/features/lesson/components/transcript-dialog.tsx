"use client";

/**
 * "Build from transcript" (Section 5.8): the student pastes the transcript YouTube shows under
 * ⋯ → Show transcript. Sapience never scrapes captions itself.
 */
import { useId, useState, useTransition } from "react";

import { ContentPasteIcon, ProgressActivityIcon } from "@/components/icons";
import { MorphText } from "@/components/motion/morph-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { OutputLanguage } from "@/config/enums";
import { requestJson } from "@/lib/client-api";
import { CreateLessonResponseSchema, MAX_TRANSCRIPT_CHARS, type CreateLessonResponse } from "@/types/contracts";

export function TranscriptDialog({
  videoUrl,
  language,
  onCreated,
  triggerLabel = "Build from transcript",
  triggerVariant = "outline",
}: {
  videoUrl: string;
  language: OutputLanguage;
  onCreated: (result: CreateLessonResponse) => void;
  triggerLabel?: string;
  triggerVariant?: "outline" | "ghost" | "default" | "link";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tooLong = text.length > MAX_TRANSCRIPT_CHARS;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await requestJson("/api/lessons", CreateLessonResponseSchema, {
        body: { url: videoUrl, language, transcript: text },
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      setText("");
      onCreated(result.data);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={triggerVariant}>
          <ContentPasteIcon />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium tracking-[-0.01em]">Build from the transcript</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            On YouTube, open the video&apos;s description, choose <strong className="font-medium text-foreground">Show transcript</strong>,
            select everything in the transcript panel and paste it below. The lesson is built from the words only, so
            anything written on the board won&apos;t be in the notes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label htmlFor={`${id}-text`} className="text-sm font-medium">
            Transcript
          </label>
          <Textarea
            id={`${id}-text`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"0:00\nWelcome back. Today we start with…"}
            className="h-56 resize-y rounded-[10px] font-mono text-[0.8125rem] placeholder:text-faint"
            aria-invalid={tooLong || undefined}
            aria-describedby={`${id}-hint`}
          />
          <p id={`${id}-hint`} className={tooLong ? "text-[0.8125rem] text-destructive" : "text-[0.8125rem] text-faint"}>
            {tooLong ? "That's more than 200 KB. Paste a shorter transcript." : "Lines need their timestamps, like 1:05 or 1:02:03."}
          </p>
          {error ? (
            <p role="alert" className="animate-fade text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" onClick={submit} disabled={pending || text.trim().length === 0 || tooLong}>
            {pending ? <ProgressActivityIcon className="animate-spin motion-reduce:animate-none" /> : null}
            <MorphText>{pending ? "Starting…" : "Build lesson"}</MorphText>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
