"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { LinkIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OUTPUT_LANGUAGE_NAMES, OUTPUT_LANGUAGES, type OutputLanguage } from "@/config/enums";
import { TranscriptDialog } from "@/features/lesson/components/transcript-dialog";
import { requestJson } from "@/lib/client-api";
import { parseYouTubeUrl } from "@/lib/youtube/parse-url";
import { CreateLessonResponseSchema, type CreateLessonResponse } from "@/types/contracts";

/** The single input that starts a lesson (Section 5.1, 5.12). */
export function PasteBox({ defaultLanguage, videoLessons }: { defaultLanguage: OutputLanguage; videoLessons: boolean }) {
  const id = useId();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState<OutputLanguage>(defaultLanguage);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const parsed = parseYouTubeUrl(url);
  const canonicalUrl = parsed ? `https://www.youtube.com/watch?v=${parsed.videoId}` : null;

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
    startTransition(async () => {
      const result = await requestJson("/api/lessons", CreateLessonResponseSchema, { body: { url, language } });
      if (result.ok) open(result.data);
      else setError({ code: result.code, message: result.message });
    });
  };

  const offerTranscript = canonicalUrl !== null && (!videoLessons || error?.code === "video_ai_unavailable");
  const noteId = `${id}-note`;

  return (
    <form className="grid gap-3" onSubmit={submit} noValidate aria-describedby={noteId}>
      <div className="flex flex-col gap-1.5 rounded-[14px] border bg-card p-1.5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[border-color,box-shadow] duration-150 ease-(--ease-out) focus-within:border-ring focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_18%,transparent)] sm:flex-row sm:items-center dark:shadow-none">
        <label htmlFor={`${id}-url`} className="sr-only">
          YouTube lecture link
        </label>
        <div className="relative flex-1">
          <LinkIcon className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`${id}-url`}
            type="url"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            aria-invalid={error?.code === "invalid_url" || undefined}
            className="h-11 rounded-[8px] border-transparent bg-transparent pl-10 shadow-none focus-visible:border-transparent focus-visible:ring-0 md:h-10 dark:bg-transparent"
          />
        </div>
        <label htmlFor={`${id}-lang`} className="sr-only">
          Lesson language
        </label>
        <select
          id={`${id}-lang`}
          value={language}
          onChange={(e) => setLanguage(e.target.value as OutputLanguage)}
          className="h-11 rounded-[8px] border-0 bg-muted px-3 text-sm text-foreground md:h-10"
        >
          {OUTPUT_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {OUTPUT_LANGUAGE_NAMES[lang]}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pending || url.trim().length === 0} className="rounded-[8px]">
          {pending ? "Checking the video…" : "Build lesson"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : (
        <p id={noteId} className="text-sm text-muted-foreground">
          {videoLessons
            ? "Lessons someone already built open instantly and don't count toward your daily limit."
            : "Video lessons aren't available right now. Paste the link, then add the video's transcript."}
        </p>
      )}

      {offerTranscript && canonicalUrl ? (
        <div>
          <TranscriptDialog videoUrl={canonicalUrl} language={language} onCreated={open} />
        </div>
      ) : null}
    </form>
  );
}
