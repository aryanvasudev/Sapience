import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ArrowBackIcon } from "@/components/icons";
import { CheckpointMark } from "@/components/layout/wordmark";
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
    <Suspense fallback={<div aria-hidden className="mx-auto h-[60vh] max-w-3xl animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />}>
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
      <div className="-mt-2 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2.5 text-muted-foreground">
          <Link href={lessonHref}>
            <ArrowBackIcon />
            Back to the lesson
          </Link>
        </Button>
        <PrintButton />
      </div>

      <header className="enter grid gap-2 border-b pb-6 print:border-black/30">
        <p className="text-[0.8125rem] text-muted-foreground print:text-black/60">
          Exam sheet · {OUTPUT_LANGUAGE_NAMES[language]}
          {fixture ? " · Test fixture" : ""}
        </p>
        <h1 className="text-title font-semibold text-balance print:text-[20pt]">{sheet.video.title}</h1>
        {sheet.video.channelTitle ? <p className="text-sm text-muted-foreground print:text-black/60">{sheet.video.channelTitle}</p> : null}
        <AiLabel fixture={fixture} note="check against the lecture" className="text-faint print:text-black/60" />
        {sheet.chapters.length < sheet.chaptersTotal ? (
          <p className="text-sm text-muted-foreground">
            {sheet.chapters.length} of {sheet.chaptersTotal} chapters are ready. The rest appear here once they&apos;re built.
          </p>
        ) : null}
      </header>

      {sheet.lesson.overview ? (
        <section aria-labelledby="overview-heading" className="grid gap-2">
          <h2 id="overview-heading" className="text-lg font-medium tracking-[-0.01em] print:text-[13pt]">
            Overview
          </h2>
          <Markdown className="text-[0.9375rem]">{sheet.lesson.overview}</Markdown>
        </section>
      ) : null}

      {formulas.length > 0 ? (
        <section aria-labelledby="formulas-heading" className="grid gap-3 break-inside-avoid">
          <h2 id="formulas-heading" className="text-lg font-medium tracking-[-0.01em] print:text-[13pt]">
            Formulas
          </h2>
          <ul className="grid gap-x-6 gap-y-3 rounded-2xl border bg-card p-5 sm:grid-cols-2 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] print:border-black/30 print:bg-transparent print:shadow-none">
            {formulas.map(({ f, chapter }, i) => (
              <li key={`${chapter}-${i}`} className="grid gap-0.5 overflow-x-auto">
                <Markdown className="text-[0.9375rem]">{`$$${f}$$`}</Markdown>
                <span className="text-[0.75rem] text-faint print:text-black/60">Chapter {chapter + 1}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sheet.missed.length > 0 ? (
        <section aria-labelledby="missed-heading" className="grid gap-4">
          <h2 id="missed-heading" className="text-lg font-medium tracking-[-0.01em] print:text-[13pt]">
            Questions to review
          </h2>
          <ol className="grid gap-3">
            {sheet.missed.map((q) => (
              <MissedItem key={q.chapterPosition} q={q} />
            ))}
          </ol>
        </section>
      ) : null}

      <section aria-labelledby="notes-heading" className="grid gap-8">
        <h2 id="notes-heading" className="text-lg font-medium tracking-[-0.01em] print:text-[13pt]">
          Notes by chapter
        </h2>
        {sheet.chapters.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">No chapter is ready yet.</p>
        ) : (
          sheet.chapters.map((c) => (
            <section key={c.position} aria-labelledby={`ch-${c.position}`} className="grid gap-3">
              <h3 id={`ch-${c.position}`} className="flex flex-wrap items-baseline gap-x-3 text-base font-medium">
                <span>
                  <span className="font-mono text-[0.875rem] text-faint tabular-nums print:text-black/60">{c.position + 1}</span> {c.title}
                </span>
                <span className="font-mono text-[0.75rem] font-normal text-faint tabular-nums print:text-black/60">
                  {formatTimestamp(c.startSeconds)}–{formatTimestamp(c.endSeconds)}
                </span>
              </h3>
              {c.summary ? <p className="text-[0.9375rem] leading-relaxed text-muted-foreground print:text-black/70">{c.summary}</p> : null}
              {c.notesMarkdown ? <Markdown className="text-[0.9375rem]">{c.notesMarkdown}</Markdown> : null}
              {c.keyTerms.length > 0 ? (
                <p className="text-sm text-muted-foreground print:text-black/70">
                  <span className="font-medium text-foreground">Key terms: </span>
                  {c.keyTerms.join(" · ")}
                </p>
              ) : null}
            </section>
          ))
        )}
      </section>

      {sheet.notes.length > 0 ? (
        <section aria-labelledby="mine-heading" className="grid gap-3">
          <h2 id="mine-heading" className="text-lg font-medium tracking-[-0.01em] print:text-[13pt]">
            Your notes
          </h2>
          <ul className="grid gap-2">
            {sheet.notes.map((n) => (
              <li key={n.id} className="flex gap-3 break-inside-avoid text-[0.9375rem]">
                <span className="w-14 shrink-0 pt-px font-mono text-[0.8125rem] text-faint tabular-nums print:text-black/60">
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
          <h2 id="saved-heading" className="text-lg font-medium tracking-[-0.01em] print:text-[13pt]">
            Saved concepts
          </h2>
          <ul className="grid gap-3">
            {sheet.savedConcepts.map((c) => (
              <li
                key={c.id}
                className="grid gap-1.5 break-inside-avoid rounded-xl border bg-card p-4 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] print:border-black/30 print:bg-transparent print:shadow-none"
              >
                <div className="flex items-baseline justify-between gap-3 font-medium">
                  <Markdown inline className="min-w-0">
                    {c.title}
                  </Markdown>
                  {c.sourceSeconds !== null ? (
                    <span className="shrink-0 font-mono text-[0.75rem] font-normal text-faint tabular-nums print:text-black/60">
                      {formatTimestamp(c.sourceSeconds)}
                    </span>
                  ) : null}
                </div>
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
    <li className="grid gap-3 break-inside-avoid rounded-xl border bg-card p-4 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] print:border-black/30 print:bg-transparent print:shadow-none">
      <p className="flex items-center gap-2 text-[0.75rem] text-faint print:text-black/60">
        <CheckpointMark className="size-1.5 print:hidden" />
        <span className="min-w-0">
          Chapter {q.chapterPosition + 1} · {q.chapterTitle} ·{" "}
          <span className="font-mono tabular-nums">{formatTimestamp(q.startSeconds)}</span>
        </span>
      </p>
      <div className="font-medium">
        <Markdown inline>{q.prompt}</Markdown>
      </div>
      <ul className="grid gap-1.5 text-sm">
        {q.options.map((option, i) => (
          <li
            key={i}
            className={cn(
              "flex gap-2 rounded-lg px-2 py-1",
              i === q.correctIndex && "bg-positive/10 font-medium print:bg-transparent print:underline",
              i === q.selectedIndex && i !== q.correctIndex && "text-muted-foreground line-through print:text-black/60",
            )}
          >
            <span className="w-4 shrink-0 font-mono text-[0.8125rem] tabular-nums">{LETTERS[i]}</span>
            <span className="min-w-0 flex-1">
              <Markdown inline>{option}</Markdown>
            </span>
            {i === q.correctIndex ? <span className="shrink-0 text-xs text-positive print:text-black">correct</span> : null}
            {i === q.selectedIndex && i !== q.correctIndex ? (
              <span className="shrink-0 text-xs text-destructive print:text-black/60">your answer</span>
            ) : null}
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
