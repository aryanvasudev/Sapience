import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ArrowBackIcon } from "@/components/icons";
import { AiLabel } from "@/components/shared/ai-label";
import { Markdown } from "@/components/shared/markdown";
import { Button } from "@/components/ui/button";
import { OUTPUT_LANGUAGE_NAMES, OUTPUT_LANGUAGES, type OutputLanguage } from "@/config/enums";
import { PrintButton } from "@/features/exam-sheet/print-button";
import { requireUser } from "@/lib/auth";
import { buildExamSheet, type MissedQuestion } from "@/lib/exam-sheet/service";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { YouTubeVideoId } from "@/types/contracts";

export const metadata: Metadata = { title: "Exam sheet" };

const LETTERS = ["A", "B", "C", "D"];

export default function ExamSheetPage({ params, searchParams }: PageProps<"/app/lesson/[videoId]/sheet">) {
  return (
    <Suspense fallback={<div aria-hidden className="h-[60vh] max-w-3xl animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />}>
      <SheetLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SheetLoader({
  params,
  searchParams,
}: {
  params: PageProps<"/app/lesson/[videoId]/sheet">["params"];
  searchParams: PageProps<"/app/lesson/[videoId]/sheet">["searchParams"];
}) {
  const [{ videoId: rawId }, query] = await Promise.all([params, searchParams]);
  const id = YouTubeVideoId.safeParse(rawId);
  if (!id.success) notFound();
  const videoId = id.data;
  const user = await requireUser(`/app/lesson/${videoId}/sheet`);
  const language: OutputLanguage = (OUTPUT_LANGUAGES as readonly string[]).includes(String(query.lang))
    ? (query.lang as OutputLanguage)
    : "en";

  const sheet = await buildExamSheet(user, videoId, language);
  if (!sheet) notFound();
  const fixture = sheet.lesson.source === "fixture";
  const lessonHref = `/app/lesson/${videoId}?lang=${language}`;
  const formulas = sheet.chapters.flatMap((c) => c.formulas.map((f) => ({ f, chapter: c.position })));

  return (
    <article className="mx-auto grid max-w-3xl gap-10 print:max-w-none print:gap-7 print:text-[11pt]">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={lessonHref}>
            <ArrowBackIcon />
            Back to the lesson
          </Link>
        </Button>
        <PrintButton />
      </div>

      <header className="grid gap-2 border-b pb-6">
        <p className="text-sm text-muted-foreground">
          Exam sheet · {OUTPUT_LANGUAGE_NAMES[language]}
          {fixture ? " · Test fixture" : ""}
        </p>
        <h1 className="font-serif text-title font-medium text-balance print:text-[20pt]">{sheet.video.title}</h1>
        {sheet.video.channelTitle ? <p className="text-sm text-muted-foreground">{sheet.video.channelTitle}</p> : null}
        <AiLabel fixture={fixture} note="check against the lecture" />
        {sheet.chapters.length < sheet.chaptersTotal ? (
          <p className="text-sm text-muted-foreground">
            {sheet.chapters.length} of {sheet.chaptersTotal} chapters are ready. The rest appear here once they&apos;re built.
          </p>
        ) : null}
      </header>

      {sheet.lesson.overview ? (
        <section aria-labelledby="overview-heading" className="grid gap-2">
          <h2 id="overview-heading" className="font-serif text-xl font-medium">
            Overview
          </h2>
          <Markdown className="text-[0.9375rem]">{sheet.lesson.overview}</Markdown>
        </section>
      ) : null}

      {formulas.length > 0 ? (
        <section aria-labelledby="formulas-heading" className="grid gap-3 break-inside-avoid">
          <h2 id="formulas-heading" className="font-serif text-xl font-medium">
            Formulas
          </h2>
          <ul className="grid gap-2 rounded-lg border p-4 sm:grid-cols-2 print:border-black/30">
            {formulas.map(({ f, chapter }, i) => (
              <li key={`${chapter}-${i}`} className="grid gap-0.5 overflow-x-auto">
                <Markdown className="text-[0.9375rem]">{`$$${f}$$`}</Markdown>
                <span className="text-xs text-muted-foreground">Chapter {chapter + 1}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sheet.missed.length > 0 ? (
        <section aria-labelledby="missed-heading" className="grid gap-4">
          <h2 id="missed-heading" className="font-serif text-xl font-medium">
            Questions to review
          </h2>
          <ol className="grid gap-4">
            {sheet.missed.map((q) => (
              <MissedItem key={q.chapterPosition} q={q} />
            ))}
          </ol>
        </section>
      ) : null}

      <section aria-labelledby="notes-heading" className="grid gap-8">
        <h2 id="notes-heading" className="font-serif text-xl font-medium">
          Notes by chapter
        </h2>
        {sheet.chapters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No chapter is ready yet.</p>
        ) : (
          sheet.chapters.map((c) => (
            <section key={c.position} aria-labelledby={`ch-${c.position}`} className="grid gap-3">
              <h3 id={`ch-${c.position}`} className="flex flex-wrap items-baseline gap-x-3 font-serif text-lg font-medium">
                <span>
                  {c.position + 1}. {c.title}
                </span>
                <span className="font-sans text-sm font-normal text-muted-foreground tabular-nums">
                  {formatTimestamp(c.startSeconds)}–{formatTimestamp(c.endSeconds)}
                </span>
              </h3>
              {c.summary ? <p className="text-[0.9375rem] text-muted-foreground print:text-black/70">{c.summary}</p> : null}
              {c.notesMarkdown ? <Markdown className="text-[0.9375rem]">{c.notesMarkdown}</Markdown> : null}
              {c.keyTerms.length > 0 ? (
                <p className="text-sm">
                  <span className="font-medium">Key terms: </span>
                  {c.keyTerms.join(" · ")}
                </p>
              ) : null}
            </section>
          ))
        )}
      </section>

      {sheet.notes.length > 0 ? (
        <section aria-labelledby="mine-heading" className="grid gap-3">
          <h2 id="mine-heading" className="font-serif text-xl font-medium">
            Your notes
          </h2>
          <ul className="grid gap-2">
            {sheet.notes.map((n) => (
              <li key={n.id} className="flex gap-3 break-inside-avoid text-[0.9375rem]">
                <span className="w-14 shrink-0 text-sm text-muted-foreground tabular-nums">
                  {n.seconds !== null ? formatTimestamp(n.seconds) : ""}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap">{n.content ?? (n.kind === "bookmark" ? "Bookmark" : "")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sheet.savedConcepts.length > 0 ? (
        <section aria-labelledby="saved-heading" className="grid gap-4">
          <h2 id="saved-heading" className="font-serif text-xl font-medium">
            Saved concepts
          </h2>
          <ul className="grid gap-3">
            {sheet.savedConcepts.map((c) => (
              <li key={c.id} className="grid gap-1 break-inside-avoid rounded-lg border p-4 print:border-black/30">
                <p className="font-medium">
                  <Markdown inline>{c.title}</Markdown>
                  {c.sourceSeconds !== null ? (
                    <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">{formatTimestamp(c.sourceSeconds)}</span>
                  ) : null}
                </p>
                {c.explanationMarkdown ? <Markdown className="text-sm">{c.explanationMarkdown}</Markdown> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="hidden border-t pt-3 text-xs text-black/60 print:block">
        Sapience exam sheet · youtube.com/watch?v={videoId} ·{" "}
        {fixture ? "Test fixture, hand-written." : "AI-generated notes may contain errors."}
      </footer>
    </article>
  );
}

function MissedItem({ q }: { q: MissedQuestion }) {
  return (
    <li className="grid gap-3 break-inside-avoid rounded-lg border p-4 print:border-black/30">
      <p className="text-xs text-muted-foreground">
        Chapter {q.chapterPosition + 1} · {q.chapterTitle} · {formatTimestamp(q.startSeconds)}
      </p>
      <div className="font-medium">
        <Markdown inline>{q.prompt}</Markdown>
      </div>
      <ul className="grid gap-1.5 text-sm">
        {q.options.map((option, i) => (
          <li
            key={i}
            className={cn(
              "flex gap-2 rounded-md px-2 py-1",
              i === q.correctIndex && "bg-highlight/40 font-medium print:bg-transparent print:underline",
              i === q.selectedIndex && i !== q.correctIndex && "text-muted-foreground line-through",
            )}
          >
            <span className="w-4 shrink-0 tabular-nums">{LETTERS[i]}</span>
            <span className="min-w-0 flex-1">
              <Markdown inline>{option}</Markdown>
            </span>
            {i === q.correctIndex ? <span className="text-xs">correct</span> : null}
            {i === q.selectedIndex && i !== q.correctIndex ? <span className="text-xs">your answer</span> : null}
          </li>
        ))}
      </ul>
      <Markdown className="text-sm">{q.explanation}</Markdown>
      {q.misconception ? (
        <p className="text-sm text-muted-foreground print:text-black/70">
          <span className="font-medium text-foreground">A common mix-up: </span>
          {q.misconception}
        </p>
      ) : null}
    </li>
  );
}
