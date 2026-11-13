import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { isAdmin, usageReport, USAGE_WINDOW_DAYS } from "@/lib/admin/usage";
import { perCall, type Bucket } from "@/lib/admin/summarize";
import { requireUser } from "@/lib/auth";
import { formatDuration } from "@/lib/format";

export const metadata: Metadata = { title: "Usage", robots: { index: false } };

const n = new Intl.NumberFormat("en-IN");
const fmt = (v: number | null) => (v === null ? "–" : n.format(v));
const secs = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)} s`);
const pct = (part: number, whole: number) => (whole === 0 ? "–" : `${Math.round((part / whole) * 100)}%`);

/** P1 admin page (Section 3.2): real per-lesson token and time numbers from `ai_calls`. */
export default function UsagePage() {
  return (
    <div className="grid gap-10">
      <header className="grid gap-2">
        <h1 className="font-serif text-title font-medium">Usage</h1>
        <p className="text-[0.9375rem] text-muted-foreground">
          Every AI call from the last {USAGE_WINDOW_DAYS} days, from <code className="font-mono text-sm">ai_calls</code>. Admins
          only.
        </p>
      </header>
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />}>
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
  if (total.calls === 0) return <p className="text-sm text-muted-foreground">No AI calls in this period yet.</p>;

  return (
    <div className="grid gap-12">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="AI calls" value={fmt(total.calls)} />
        <Stat label="Succeeded" value={pct(total.ok, total.calls)} />
        <Stat label="Tokens in / out" value={`${fmt(total.inputTokens)} / ${fmt(total.outputTokens)}`} />
        <Stat label="On students' own keys" value={pct(total.byok, total.calls)} />
      </dl>
      {report.truncated ? <p className="text-sm text-muted-foreground">Showing the most recent 20,000 calls only.</p> : null}

      <BucketTable title="By call kind" rows={report.byKind} label={(b) => b.key} />
      <BucketTable title="By model" rows={report.byModel} label={(b) => b.key} />

      <section aria-labelledby="lessons-usage" className="grid gap-3">
        <h2 id="lessons-usage" className="font-serif text-xl font-medium">
          Lesson builds
        </h2>
        <p className="text-sm text-muted-foreground">Outline, chapter, full and transcript calls per lesson. Time is the sum of model call times.</p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-muted/60 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Lecture</th>
                <th className="px-3 py-2 font-medium">Length</th>
                <th className="px-3 py-2 text-right font-medium">Calls</th>
                <th className="px-3 py-2 text-right font-medium">Tokens in</th>
                <th className="px-3 py-2 text-right font-medium">Tokens out</th>
                <th className="px-3 py-2 text-right font-medium">Model time</th>
                <th className="px-3 py-2 text-right font-medium">In / video min</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.byLesson.slice(0, 50).map((b) => {
                const lesson = report.lessons.get(b.key);
                const minutes = lesson ? lesson.durationSeconds / 60 : 0;
                return (
                  <tr key={b.key}>
                    <td className="max-w-[18rem] px-3 py-2">
                      <span className="line-clamp-1">{lesson?.title ?? b.key}</span>
                      {lesson ? (
                        <span className="text-xs text-muted-foreground">
                          {lesson.language} · {lesson.source}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{lesson ? formatDuration(lesson.durationSeconds) : "–"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(b.calls)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(b.inputTokens)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(b.outputTokens)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{secs(b.durationMs)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{minutes > 0 ? fmt(Math.round(b.inputTokens / minutes)) : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-lg border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-serif text-2xl font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function BucketTable({ title, rows, label }: { title: string; rows: Bucket[]; label: (b: Bucket) => string }) {
  return (
    <section className="grid gap-3">
      <h2 className="font-serif text-xl font-medium">{title}</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-muted/60 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{title.replace("By ", "")}</th>
              <th className="px-3 py-2 text-right font-medium">Calls</th>
              <th className="px-3 py-2 text-right font-medium">OK</th>
              <th className="px-3 py-2 text-right font-medium">Fell back</th>
              <th className="px-3 py-2 text-right font-medium">Avg in</th>
              <th className="px-3 py-2 text-right font-medium">Avg out</th>
              <th className="px-3 py-2 text-right font-medium">Avg time</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((b) => (
              <tr key={b.key}>
                <td className="px-3 py-2 font-mono text-xs">{label(b)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(b.calls)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(b.ok, b.calls)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(b.fallbacks)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(perCall(b, "inputTokens"))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(perCall(b, "outputTokens"))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{secs(perCall(b, "durationMs"))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
