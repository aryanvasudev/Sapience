"use client";

import { useState, useTransition } from "react";

import { CheckIcon, ContentCopyIcon, QrCode2Icon, RefreshIcon } from "@/components/icons";
import { MorphText } from "@/components/motion/morph-text";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatRoomCode, joinPath } from "@/lib/rooms/code";

import { rotateCode } from "../actions";
import { QrCode } from "./qr-code";

/**
 * The room's code, its invite link and QR. Owners can replace the code, which stops old links and
 * QR codes from working (members already in the room stay).
 */
export function InviteCard({ roomId, roomName, code, isOwner, appUrl }: { roomId: string; roomName: string; code: string; isOwner: boolean; appUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [pending, startTransition] = useTransition();
  const link = () => `${(typeof window !== "undefined" ? window.location.origin : appUrl).replace(/\/$/, "")}${joinPath(code)}`;

  return (
    <section aria-labelledby="invite-heading" className="grid gap-4 rounded-2xl border bg-card p-5 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <h2 id="invite-heading" className="text-[0.9375rem] font-medium">
            Invite classmates
          </h2>
          <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">Share the code, the link, or let them scan the QR.</p>
        </div>
        <span className="shrink-0 rounded-lg border bg-surface px-2.5 py-1.5 font-mono text-lg font-medium tracking-[0.14em] tabular-nums" aria-label={`Room code ${code.split("").join(" ")}`}>
          {formatRoomCode(code)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            const url = link();
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2500);
            } catch {
              setManual(url);
            }
          }}
        >
          {copied ? <CheckIcon className="animate-fade" /> : <ContentCopyIcon />}
          <MorphText>{copied ? "Link copied" : "Copy invite link"}</MorphText>
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" size="sm" variant="outline">
              <QrCode2Icon />
              Show QR
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle>{roomName}</DialogTitle>
              <DialogDescription>Scan with a phone camera or from Study rooms → Scan QR.</DialogDescription>
            </DialogHeader>
            <QrCode value={link()} label={`QR code to join ${roomName}`} className="mx-auto w-full max-w-64" />
            <p className="text-center font-mono text-xl font-medium tracking-[0.14em] tabular-nums">{formatRoomCode(code)}</p>
          </DialogContent>
        </Dialog>
        {isOwner ? (
          confirmRotate ? (
            <span className="flex animate-fade flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await rotateCode({ roomId });
                    if (!result.ok) setError(result.message);
                    setConfirmRotate(false);
                  })
                }
              >
                Replace code
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRotate(false)}>
                Keep it
              </Button>
            </span>
          ) : (
            <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setConfirmRotate(true)}>
              <RefreshIcon />
              New code
            </Button>
          )
        ) : null}
      </div>
      {confirmRotate ? (
        <p className="animate-fade text-[0.8125rem] text-muted-foreground">Old links and QR codes stop working. People already here stay.</p>
      ) : null}
      {manual ? (
        <input
          readOnly
          aria-label="Invite link"
          value={manual}
          onFocus={(e) => e.currentTarget.select()}
          className="h-8 w-full animate-fade rounded-lg border bg-surface px-3 font-mono text-[0.75rem] text-muted-foreground"
        />
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {copied ? "Invite link copied" : ""}
      </span>
    </section>
  );
}
