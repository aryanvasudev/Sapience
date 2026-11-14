"use client";

import { useEffect, useId, useState, useTransition } from "react";

import { ArrowOutwardIcon, CheckIcon, ContentCopyIcon, InfoIcon, SyncIcon } from "@/components/icons";
import { MorphText } from "@/components/motion/morph-text";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { getOrCreateFeed, resetFeed, type FeedResult } from "../feed-actions";

const GOOGLE_ADD_BY_URL = "https://calendar.google.com/calendar/u/0/r/settings/addbyurl";

const isLocal = (url: string) => {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
  } catch {
    return false;
  }
};

/**
 * Keep Google Calendar in step with Sapience by subscribing to a private iCalendar URL. No Google
 * sign-in: Google fetches the feed itself every few hours.
 */
export function SyncDialog({ open, onOpenChange, isAnonymous }: { open: boolean; onOpenChange: (open: boolean) => void; isAnonymous: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-medium tracking-[-0.01em]">
            <SyncIcon className="size-5 text-muted-foreground" />
            Sync with Google Calendar
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Subscribe once and your study sessions, study room deadlines and revision days appear in Google Calendar,
            and stay up to date.
          </DialogDescription>
        </DialogHeader>
        {open ? <SyncBody isAnonymous={isAnonymous} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SyncBody({ isAnonymous }: { isAnonymous: boolean }) {
  const id = useId();
  const [feed, setFeed] = useState<FeedResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getOrCreateFeed().then((r) => {
      if (!cancelled) setFeed(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (feed === null) {
    return (
      <div aria-hidden className="grid gap-3">
        <div className="h-10 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="h-24 animate-pulse rounded-lg bg-muted/70 motion-reduce:animate-none" />
      </div>
    );
  }
  if (!feed.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {feed.message}
      </p>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feed.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      document.getElementById(`${id}-url`)?.focus();
    }
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <label htmlFor={`${id}-url`} className="text-sm font-medium">
          Your private calendar link
        </label>
        <div className="flex gap-2">
          <input
            id={`${id}-url`}
            readOnly
            value={feed.url}
            onFocus={(e) => e.currentTarget.select()}
            className="h-10 min-w-0 flex-1 rounded-lg border bg-card px-3 font-mono text-[0.75rem] text-muted-foreground outline-none focus-visible:border-brand/60 focus-visible:ring-[3px] focus-visible:ring-brand/15"
          />
          <Button type="button" variant="outline" onClick={() => void copy()} className="shrink-0">
            {copied ? <CheckIcon className="animate-fade" /> : <ContentCopyIcon />}
            <MorphText>{copied ? "Copied" : "Copy"}</MorphText>
          </Button>
        </div>
        <span className="sr-only" aria-live="polite">
          {copied ? "Calendar link copied" : ""}
        </span>
        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
          Anyone with this link can see your study plan. Keep it to yourself.
        </p>
      </div>

      <ol className="grid gap-2 text-sm leading-relaxed">
        {[
          "Copy the link above.",
          "In Google Calendar, open Settings → Add calendar → From URL.",
          "Paste the link and choose Add calendar.",
        ].map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="inline-flex size-5 shrink-0 translate-y-0.5 items-center justify-center rounded-full border font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={GOOGLE_ADD_BY_URL} target="_blank" rel="noopener noreferrer">
            Open Google Calendar
            <ArrowOutwardIcon className="size-4" />
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={feed.webcalUrl}>Subscribe in Apple Calendar</a>
        </Button>
      </div>

      <div className="grid gap-2 rounded-[10px] border bg-surface p-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
        <p className="flex gap-2">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Google checks subscribed calendars every few hours, so a new session can take a while to appear there. For
            something you need right away, use &ldquo;Add to Google Calendar&rdquo; on the session.
          </span>
        </p>
        {isLocal(feed.url) ? (
          <p className="pl-6 text-foreground/90">
            This link points at a local address, so Google can&apos;t reach it. It works once Sapience runs on a public
            address (set <span className="font-mono text-[0.75rem]">NEXT_PUBLIC_APP_URL</span>).
          </p>
        ) : null}
        {isAnonymous ? (
          <p className="pl-6">
            You&apos;re using a guest session. If you sign out, this calendar stops updating. Create an account to keep it.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4">
        <p className="mr-auto text-[0.8125rem] text-muted-foreground">Shared the link by mistake?</p>
        {confirmReset ? (
          <>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await resetFeed();
                  setFeed(r);
                  setConfirmReset(false);
                })
              }
            >
              Reset link
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setConfirmReset(true)}>
            Reset link…
          </Button>
        )}
      </div>
      {confirmReset ? (
        <p className="-mt-3 animate-fade text-[0.8125rem] text-muted-foreground">
          The old link stops working. Calendars subscribed to it stop updating until you add the new one.
        </p>
      ) : null}
    </div>
  );
}
