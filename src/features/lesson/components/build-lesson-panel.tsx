"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ArrowForwardIcon } from "@/components/icons";
import { MorphText } from "@/components/motion/morph-text";
import { Button } from "@/components/ui/button";
import { OUTPUT_LANGUAGE_NAMES, type OutputLanguage } from "@/config/enums";
import { requestJson } from "@/lib/client-api";
import { CreateLessonResponseSchema } from "@/types/contracts";

import { StepList } from "./journey";
import { TranscriptDialog } from "./transcript-dialog";

/** Opened /app/lesson/<id> for a video with no lesson in this language yet. */
export function BuildLessonPanel({ videoId, language, title }: { videoId: string; language: OutputLanguage; title: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  const build = () => {
    setError(null);
    setStarted(false);
    startTransition(async () => {
      const result = await requestJson("/api/lessons", CreateLessonResponseSchema, { body: { url, language } });
      if (!result.ok) setError(result.message);
      else {
        setStarted(true);
        router.refresh();
      }
    });
  };

  return (
    <section className="enter max-w-[40rem]">
      <h1 className="text-title font-semibold text-balance">{title ?? "This lecture has no lesson yet"}</h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
        There&apos;s no {OUTPUT_LANGUAGE_NAMES[language]} lesson for this video yet. Building one counts toward today&apos;s
        limit; after that it&apos;s shared with every student.
      </p>
      {error ? (
        <p role="alert" className="mt-4 animate-fade text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {pending ? (
        <StepList
          className="mt-5 animate-fade [animation-duration:200ms]"
          steps={[
            {
              label: "Checking the video",
              detail: "Making sure it's public, embeddable and 1 to 90 minutes long.",
              state: started ? "done" : "active",
            },
            {
              label: "Starting your lesson",
              detail: "The video plays straight away. Chapters and notes fill in while you watch.",
              state: started ? "active" : "upcoming",
            },
          ]}
        />
      ) : null}
      <div className="mt-7 flex flex-wrap gap-2">
        <Button type="button" onClick={build} disabled={pending}>
          <MorphText>{pending ? "Starting…" : "Build this lesson"}</MorphText>
          {pending ? null : <ArrowForwardIcon data-icon="inline-end" />}
        </Button>
        <TranscriptDialog videoUrl={url} language={language} onCreated={() => router.refresh()} />
      </div>
    </section>
  );
}
