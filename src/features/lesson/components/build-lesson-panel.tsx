"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { OUTPUT_LANGUAGE_NAMES, type OutputLanguage } from "@/config/enums";
import { requestJson } from "@/lib/client-api";
import { CreateLessonResponseSchema } from "@/types/contracts";

import { TranscriptDialog } from "./transcript-dialog";

/** Opened /app/lesson/<id> for a video with no lesson in this language yet. */
export function BuildLessonPanel({ videoId, language, title }: { videoId: string; language: OutputLanguage; title: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  const build = () => {
    setError(null);
    startTransition(async () => {
      const result = await requestJson("/api/lessons", CreateLessonResponseSchema, { body: { url, language } });
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  };

  return (
    <section className="max-w-[36rem]">
      <h1 className="font-serif text-[2rem] leading-tight font-medium tracking-[-0.015em]">
        {title ?? "This lecture has no lesson yet"}
      </h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        There&apos;s no {OUTPUT_LANGUAGE_NAMES[language]} lesson for this video yet. Building one counts toward today&apos;s
        limit; after that it&apos;s shared with every student.
      </p>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" size="lg" onClick={build} disabled={pending}>
          {pending ? "Starting…" : "Build this lesson"}
        </Button>
        <TranscriptDialog videoUrl={url} language={language} onCreated={() => router.refresh()} />
      </div>
    </section>
  );
}
