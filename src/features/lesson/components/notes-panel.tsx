"use client";

import { ArrowBackIcon, ArrowForwardIcon } from "@/components/icons";
import { AiLabel } from "@/components/shared/ai-label";
import { Markdown } from "@/components/shared/markdown";
import { TimestampChip } from "@/components/shared/timestamp-chip";
import { Button } from "@/components/ui/button";
import { SaveConceptButton } from "@/features/revision/components/save-concept-button";
import { formatTimestamp } from "@/lib/format";
import { seekTarget } from "@/lib/timestamps";
import type { ChapterPublic, LessonPublic } from "@/types/contracts";

import katex from "katex";

function Formula({ latex }: { latex: string }) {
  // Formulas were checked with KaTeX on the server; render defensively anyway.
  const html = katex.renderToString(latex, { throwOnError: false, displayMode: true, strict: "ignore", output: "html" });
  return (
    <div
      className="overflow-x-auto rounded-[10px] border bg-surface px-3 py-1 [&_.katex-display]:my-2"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function NotesPanel({
  lesson,
  chapter,
  durationSeconds,
  onSeek,
  onSelectPosition,
}: {
  lesson: LessonPublic;
  chapter: ChapterPublic | null;
  durationSeconds: number;
  onSeek: (seconds: number) => void;
  onSelectPosition: (position: number) => void;
}) {
  const fromTranscript = lesson.source === "transcript_paste";
  const labelNote = fromTranscript ? "built from the transcript only, so board content isn't included" : undefined;
  const total = lesson.chapters.length;
  const fixture = lesson.source === "fixture";

  return (
    <div className="grid gap-6">
      {lesson.overview ? (
        <section aria-label="About this lecture" className="grid gap-2">
          <p className="text-[0.9375rem] leading-relaxed text-foreground/90">{lesson.overview}</p>
          <AiLabel note={labelNote} fixture={fixture} className="text-faint" />
        </section>
      ) : null}

      {!chapter ? (
        <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">Notes appear here as each chapter is built.</p>
      ) : (
        <article aria-labelledby="notes-chapter-title" className="grid gap-5">
          <header className="grid gap-2 border-t pt-5">
            <p className="text-[0.8125rem] text-faint">
              Chapter <span className="font-mono tabular-nums">{chapter.position + 1}</span> of{" "}
              <span className="font-mono tabular-nums">{total}</span>
            </p>
            <h2 id="notes-chapter-title" className="text-lg leading-snug font-medium tracking-[-0.01em]">
              {chapter.title}
            </h2>
            <div className="flex items-center gap-2 text-[0.8125rem] text-faint">
              <TimestampChip seconds={chapter.startSeconds} onSeek={(s) => onSeek(seekTarget(s))} label={chapter.title} />
              <span>
                to <span className="font-mono text-[0.75rem] tabular-nums">{formatTimestamp(chapter.endSeconds)}</span>
              </span>
            </div>
          </header>

          {chapter.status === "pending" ? (
            <p className="text-sm text-muted-foreground">Building the notes for this chapter. The video already plays.</p>
          ) : chapter.status === "failed" ? (
            <p className="text-sm text-muted-foreground">Couldn&apos;t build notes for this chapter. Use Retry in the chapter list.</p>
          ) : (
            <>
              {chapter.summary ? <p className="text-[0.9375rem] leading-relaxed text-foreground/90">{chapter.summary}</p> : null}
              {chapter.notesMarkdown ? (
                <Markdown onSeek={(s) => onSeek(seekTarget(s))} durationSeconds={durationSeconds}>
                  {chapter.notesMarkdown}
                </Markdown>
              ) : null}

              {chapter.formulas.length > 0 ? (
                <section aria-labelledby="notes-formulas" className="grid gap-2">
                  <h3 id="notes-formulas" className="text-sm font-medium">
                    Formulas
                  </h3>
                  {chapter.formulas.map((f) => (
                    <Formula key={f} latex={f} />
                  ))}
                </section>
              ) : null}

              {chapter.keyMoments.length > 0 ? (
                <section aria-labelledby="notes-moments" className="grid gap-2.5">
                  <h3 id="notes-moments" className="text-sm font-medium">
                    Key moments
                  </h3>
                  <ul className="grid gap-2.5">
                    {chapter.keyMoments.map((m) => (
                      <li key={m.id} className="flex items-start gap-2.5 text-[0.8125rem] leading-snug">
                        <TimestampChip seconds={m.seconds} onSeek={(s) => onSeek(seekTarget(s))} label={m.label} className="-mt-px" />
                        <span className="min-w-0 text-foreground/85">{m.label}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {chapter.keyTerms.length > 0 ? (
                <section aria-labelledby="notes-terms" className="grid gap-2.5">
                  <h3 id="notes-terms" className="text-sm font-medium">
                    Key terms
                  </h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {chapter.keyTerms.map((t) => (
                      <li key={t} className="rounded-md border bg-surface px-2 py-1 text-[0.8125rem] text-foreground/85">
                        {t}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <AiLabel note={labelNote} fixture={fixture} className="text-faint" />
                <SaveConceptButton
                  key={chapter.position}
                  size="xs"
                  variant="ghost"
                  label="Save chapter for revision"
                  concept={{
                    youtubeVideoId: lesson.youtubeVideoId,
                    language: lesson.language,
                    sourceSeconds: chapter.startSeconds,
                    title: chapter.title,
                    explanationMarkdown: [chapter.summary, chapter.notesMarkdown].filter(Boolean).join("\n\n").slice(0, 8000),
                    source: "chapter",
                  }}
                />
              </div>
            </>
          )}

          <nav aria-label="Chapter notes" className="flex justify-between gap-2 border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2.5 text-muted-foreground"
              disabled={chapter.position === 0}
              onClick={() => onSelectPosition(chapter.position - 1)}
            >
              <ArrowBackIcon />
              Previous
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-mr-2.5 text-muted-foreground"
              disabled={chapter.position >= total - 1}
              onClick={() => onSelectPosition(chapter.position + 1)}
            >
              Next
              <ArrowForwardIcon />
            </Button>
          </nav>
        </article>
      )}
    </div>
  );
}
