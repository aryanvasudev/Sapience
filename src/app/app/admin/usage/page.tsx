import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { PageHeader, SectionHeading } from "@/components/layout/page-header";
import { CountUp } from "@/components/motion/count-up";
import { isAdmin, usageReport, USAGE_WINDOW_DAYS } from "@/lib/admin/usage";
import { perCall, type Bucket } from "@/lib/admin/summarize";
import { requireUser } from "@/lib/auth";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Usage", robots: { index: false } };

const n = new Intl.NumberFormat("en-IN");
const fmt = (v: number | null) => (v === null ? "–" : n.format(v));
const secs = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)} s`);
const pct = (part: number, whole: number) => (whole === 0 ? "–" : `${Math.round((part / whole) * 100)}%`);
const pctValue = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 100));

const CARD = "rounded-2xl border bg-card dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]";
const TH = "h-9 px-4 text-xs font-normal whitespace-nowrap text-muted-foreground";
const TD = "h-10 px-4 font-mono text-[0.8125rem] whitespace-nowrap tabular-nums";

/** P1 admin page (Section 3.2): real per-lesson token and time numbers from `ai_calls`. */
export default function UsagePage() {
  return (
    <div className="grid gap-10">
      <PageHeader
        title="Usage"
        description={
          <>
            Every AI call from the last <span className="font-mono tabular-nums">{USAGE_WINDOW_DAYS}</span> days, from{" "}
            <code className="font-mono text-[0.8125rem] text-foreground">ai_calls</code>. Admins only.
          </>
        }
      />
      <Suspense fallback={<UsageSkeleton />}>
        <UsageLoader />
      </Suspense>
    </div>
  );
}

async function UsageLoader() {
  const user = await requireUser("/app/admin/usage");
  if (!isAdmin(user)) notFound();
  const report = await usageReport();
  if (!report) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Couldn&apos;t load usage. Refresh to try again.
      </p>
    );
  }
  const { total } = report;
  if (total.calls === 0) {
    return (
      <div className="enter grid max-w-xl gap-1 rounded-2xl border border-dashed p-6 [--i:1]">
        <p className="text-[0.9375rem] font-medium">No AI calls in this period yet.</p>
        <p className="text-sm text-muted-foreground">Build a lesson or ask the tutor and the calls show up here.</p>
      </div>
    );
  }

  const lessonRows = report.byLesson.slice(0, 50);

  return (
    <div className="enter grid gap-12 [--i:1]">
      <div className="grid gap-3">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border lg:grid-cols-4">
          <Stat label="AI calls">
            <CountUp value={total.calls} />
          </Stat>
          <Stat label="Succeeded">
            <Percent value={pctValue(total.ok, total.calls)} />
          </Stat>
          <Stat label="Tokens in / out">
            <CountUp value={total.inputTokens} />
            <span className="text-faint"> / </span>
            <CountUp value={total.outputTokens} />
          </Stat>
          <Stat label="On students' own keys">
            <Percent value={pctValue(total.byok, total.calls)} />
          </Stat>
        </dl>
        {report.truncated ? <p className="text-[0.8125rem] text-faint">Showing the most recent 20,000 calls only.</p> : null}
      </div>

      <BucketTable id="by-kind" title="By call kind" rows={report.byKind} label={(b) => b.key} />
      <BucketTable id="by-model" title="By model" rows={report.byModel} label={(b) => b.key} />

      <section aria-labelledby="lessons-usage" className="grid gap-3">
        <div className="grid gap-1">
          <SectionHeading
            id="lessons-usage"
            meta={<span className="font-mono text-[0.75rem] tabular-nums">{lessonRows.length}</span>}
          >
            Lesson builds
          </SectionHeading>
          <p className="text-[0.8125rem] text-muted-foreground">
            Outline, chapter, full and transcript calls per lesson. Time is the sum of model call times.
          </p>
        </div>
        <TableFrame>
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead className="border-b bg-surface/50 text-left">
              <tr>
                <th className={TH}>Lecture</th>
                <th className={TH}>Length</th>
                <th className={cn(TH, "text-right")}>Calls</th>
                <th className={cn(TH, "text-right")}>Tokens in</th>
                <th className={cn(TH, "text-right")}>Tokens out</th>
                <th className={cn(TH, "text-right")}>Model time</th>
                <th className={cn(TH, "text-right")}>In / video min</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lessonRows.map((b) => {
                const lesson = report.lessons.get(b.key);
                const minutes = lesson ? lesson.durationSeconds / 60 : 0;
                return (
                  <tr key={b.key} className="transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:bg-raised/50">
                    <td className="max-w-[20rem] px-4 py-2">
                      <span className="line-clamp-1 font-medium">{lesson?.title ?? b.key}</span>
                      {lesson ? (
                        <span className="block text-xs text-muted-foreground">
                          {lesson.language} · {lesson.source}
                        </span>
                      ) : null}
                    </td>
                    <td className={cn(TD, "text-muted-foreground")}>{lesson ? formatDuration(lesson.durationSeconds) : "–"}</td>
                    <td className={cn(TD, "text-right")}>{fmt(b.calls)}</td>
                    <td className={cn(TD, "text-right")}>{fmt(b.inputTokens)}</td>
                    <td className={cn(TD, "text-right")}>{fmt(b.outputTokens)}</td>
                    <td className={cn(TD, "text-right")}>{secs(b.durationMs)}</td>
                    <td className={cn(TD, "text-right")}>{minutes > 0 ? fmt(Math.round(b.inputTokens / minutes)) : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableFrame>
      </section>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5 bg-card p-4 sm:p-5">
      <dt className="order-2 text-xs text-muted-foreground">{label}</dt>
      <dd className="order-1 text-xl leading-tight font-semibold tracking-[-0.02em] break-words tabular-nums sm:text-2xl">
        {children}
      </dd>
    </div>
  );
}

function Percent({ value }: { value: number | null }) {
  return value === null ? <>–</> : <CountUp value={value} suffix="%" />;
}

function TableFrame({ children }: { children: ReactNode }) {
  return <div className={cn(CARD, "overflow-x-auto")}>{children}</div>;
}

function BucketTable({ id, title, rows, label }: { id: string; title: string; rows: Bucket[]; label: (b: Bucket) => string }) {
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <SectionHeading id={id} meta={<span className="font-mono text-[0.75rem] tabular-nums">{rows.length}</span>}>
        {title}
      </SectionHeading>
      <TableFrame>
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead className="border-b bg-surface/50 text-left">
            <tr>
              <th className={TH}>{title.replace("By ", "").replace(/^./, (c) => c.toUpperCase())}</th>
              <th className={cn(TH, "text-right")}>Calls</th>
              <th className={cn(TH, "text-right")}>OK</th>
              <th className={cn(TH, "text-right")}>Fell back</th>
              <th className={cn(TH, "text-right")}>Avg in</th>
              <th className={cn(TH, "text-right")}>Avg out</th>
              <th className={cn(TH, "text-right")}>Avg time</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((b) => (
              <tr key={b.key} className="transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:bg-raised/50">
                <td className={cn(TD, "text-xs")}>{label(b)}</td>
                <td className={cn(TD, "text-right")}>{fmt(b.calls)}</td>
                <td className={cn(TD, "text-right")}>{pct(b.ok, b.calls)}</td>
                <td className={cn(TD, "text-right", b.fallbacks === 0 && "text-faint")}>{fmt(b.fallbacks)}</td>
                <td className={cn(TD, "text-right")}>{fmt(perCall(b, "inputTokens"))}</td>
                <td className={cn(TD, "text-right")}>{fmt(perCall(b, "outputTokens"))}</td>
                <td className={cn(TD, "text-right")}>{secs(perCall(b, "durationMs"))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    </section>
  );
}

function UsageSkeleton() {
  return (
    <div aria-hidden className="grid gap-12">
      <div className="h-[5.5rem] animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      <div className="grid gap-3">
        <div className="h-5 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-56 animate-pulse rounded-2xl bg-muted/70 motion-reduce:animate-none" />
      </div>
    </div>
  );
}
