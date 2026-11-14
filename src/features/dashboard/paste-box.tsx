"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { ArrowForwardIcon, LinkIcon } from "@/components/icons";
import { MorphText } from "@/components/motion/morph-text";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select";
import { OUTPUT_LANGUAGE_NAMES, OUTPUT_LANGUAGES, type LessonStatus, type OutputLanguage } from "@/config/enums";
import { FOCUS_PASTE_BOX_EVENT } from "@/features/dashboard/events";
import { StepList, type ListStep } from "@/features/lesson/components/journey";
import { TranscriptDialog } from "@/features/lesson/components/transcript-dialog";
import { requestJson } from "@/lib/client-api";
import { parseYouTubeUrl } from "@/lib/youtube/parse-url";
import { cn } from "@/lib/utils";
import { CreateLessonResponseSchema, type CreateLessonResponse } from "@/types/contracts";

/** Where a submitted link is: the server checks it and finds or starts the lesson, then we navigate. */
type Phase = { step: "checking" } | { step: "opening"; status: LessonStatus };

/** The steps shown under the box while a link is being opened. Each one is a real request stage. */
function openingSteps(phase: Phase): ListStep[] {
  const opening = phase.step === "opening";
  return [
    { label: "Link recognised", state: "done" },
    {
      label: "Checking the video",
      detail: "Making sure it's public, embeddable and 1 to 90 minutes long, then finding its lesson.",
      state: opening ? "done" : "active",
    },
    {
      label: opening && phase.status === "ready" ? "Lesson found. Opening it" : opening ? "Lesson started. Opening it" : "Opening the lesson",
      detail:
        opening && phase.status === "ready"
          ? "Someone already built it, so it's free and instant."
          : "The video plays straight away. Chapters and notes fill in while you watch.",
      state: opening ? "active" : "upcoming",
    },
  ];
}

/** The single input that starts a lesson (Section 5.1, 5.12). */
export function PasteBox({ defaultLanguage, videoLessons }: { defaultLanguage: OutputLanguage; videoLessons: boolean }) {
  const id = useId();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState<OutputLanguage>(defaultLanguage);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase | null>(null);
  const parsed = parseYouTubeUrl(url);
  const canonicalUrl = parsed ? `https://www.youtube.com/watch?v=${parsed.videoId}` : null;

  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    if (window.location.hash === "#start") focus();
    window.addEventListener(FOCUS_PASTE_BOX_EVENT, focus);
    return () => window.removeEventListener(FOCUS_PASTE_BOX_EVENT, focus);
  }, []);

  const open = (result: CreateLessonResponse) => {
    const t = result.startSeconds !== undefined ? `&t=${result.startSeconds}` : "";
    router.push(`/app/lesson/${result.youtubeVideoId}?lang=${result.language}${t}`);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!parsed) {
      setError({ code: "invalid_url", message: "That doesn't look like a YouTube video link." });
      return;
    }
    setPhase({ step: "checking" });
    startTransition(async () => {
      const result = await requestJson("/api/lessons", CreateLessonResponseSchema, { body: { url, language } });
      if (result.ok) {
        setPhase({ step: "opening", status: result.data.status });
        open(result.data);
      } else {
        setPhase(null);
        setError({ code: result.code, message: result.message });
      }
    });
  };

  const offerTranscript = canonicalUrl !== null && (!videoLessons || error?.code === "video_ai_unavailable");
  const noteId = `${id}-note`;
  const recognised = parsed !== null;

  return (
    <form className="grid gap-3" onSubmit={submit} noValidate aria-describedby={noteId}>
      <div
        className={cn(
          "group/paste flex flex-col gap-1.5 rounded-2xl border bg-card p-1.5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.12)] transition-[border-color,box-shadow] duration-200 ease-(--ease-out) focus-within:border-brand/50 focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_14%,transparent)] sm:flex-row sm:items-center dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]",
          error && "border-destructive/50",
        )}
      >
        <label htmlFor={`${id}-url`} className="sr-only">
          YouTube lecture link
        </label>
        <div className="relative flex-1">
          <LinkIcon
            className={cn(
              "pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 transition-colors duration-150 ease-(--ease-out)",
              recognised ? "text-brand-ink" : "text-faint",
            )}
          />
          <input
            ref={inputRef}
            id={`${id}-url`}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Paste a YouTube lecture link"
            aria-invalid={error?.code === "invalid_url" || undefined}
            className="h-12 w-full rounded-[10px] bg-transparent pr-3 pl-11 text-[0.9375rem] outline-none placeholder:text-faint"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label htmlFor={`${id}-lang`} className="sr-only">
            Lesson language
          </label>
          <SelectField<OutputLanguage>
            id={`${id}-lang`}
            value={language}
            onValueChange={setLanguage}
            options={OUTPUT_LANGUAGES.map((lang) => ({ value: lang, label: OUTPUT_LANGUAGE_NAMES[lang] }))}
            className="h-11 flex-1 border-transparent bg-raised pl-3.5 sm:w-auto sm:min-w-32 sm:flex-none dark:bg-raised [@media(hover:hover)]:hover:border-border [@media(hover:hover)]:hover:bg-raised dark:[@media(hover:hover)]:hover:bg-raised"
          />
          <Button type="submit" disabled={pending || url.trim().length === 0} className="h-11 rounded-[10px] px-4 md:h-11">
            <MorphText>{!pending ? "Build lesson" : phase?.step === "opening" ? "Opening…" : "Checking…"}</MorphText>
            {pending ? null : <ArrowForwardIcon data-icon="inline-end" />}
          </Button>
        </div>
      </div>

      <div className="min-h-5 px-1">
        {pending && phase ? (
          <StepList steps={openingSteps(phase)} className="animate-fade [animation-duration:200ms]" />
        ) : error ? (
          <p role="alert" className="animate-fade text-sm text-destructive">
            {error.message}
          </p>
        ) : (
          <p id={noteId} className="text-[0.8125rem] text-muted-foreground">
            {videoLessons
              ? "Public lectures from 1 to 90 minutes. Lessons someone already built open instantly and don't count toward your daily limit."
              : "Video lessons aren't available right now. Paste the link, then add the video's transcript."}
          </p>
        )}
      </div>

      {offerTranscript && canonicalUrl ? (
        <div>
          <TranscriptDialog videoUrl={canonicalUrl} language={language} onCreated={open} />
        </div>
      ) : null}
    </form>
  );
}
