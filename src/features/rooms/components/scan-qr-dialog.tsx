"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

import { QrCodeScannerIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { codeFromScan } from "@/lib/rooms/code";

type CameraState = "starting" | "scanning" | "denied" | "unavailable" | "unrecognised";

const FALLBACK = "Use your phone's camera app on the QR code, or type the code.";

/** "Scan QR": reads a room's QR code with the camera and hands back its code. */
export function ScanQrDialog({ onCode, triggerClassName }: { onCode: (code: string) => void; triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={triggerClassName}>
          <QrCodeScannerIcon />
          Scan QR
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan a room&apos;s QR code</DialogTitle>
          <DialogDescription>Point your camera at the code on a classmate&apos;s screen.</DialogDescription>
        </DialogHeader>
        {open ? (
          <Scanner
            onCode={(code) => {
              setOpen(false);
              onCode(code);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Scanner({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>("starting");
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let lastScan = 0;
    let lastUnrecognised = "";

    const tick = (now: number) => {
      if (stopped) return;
      frame = requestAnimationFrame(tick);
      const video = videoRef.current;
      // ~8 reads a second is plenty, and keeps phones cool.
      if (!video || !context || video.readyState < video.HAVE_ENOUGH_DATA || now - lastScan < 120) return;
      lastScan = now;
      const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
      if (!result?.data) return;
      const code = codeFromScan(result.data);
      if (code) {
        stopped = true;
        onCodeRef.current(code);
      } else if (result.data !== lastUnrecognised) {
        lastUnrecognised = result.data;
        setState("unrecognised");
      }
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setState("scanning");
      frame = requestAnimationFrame(tick);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const failed = state === "denied" || state === "unavailable";

  return (
    <div className="grid gap-3">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-black ring-1 ring-border">
        <video ref={videoRef} muted playsInline className="size-full object-cover" aria-label="Camera preview" />
        {state === "scanning" || state === "unrecognised" ? (
          <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-brand/80 shadow-[0_0_0_100vmax_rgb(0_0_0/0.35)]" />
        ) : null}
        {failed ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm leading-relaxed text-white/80">
            <p>{state === "denied" ? "Camera access is blocked for this site." : "No camera is available here."}</p>
          </div>
        ) : null}
      </div>
      <p role="status" className="text-sm leading-relaxed text-muted-foreground">
        {state === "starting"
          ? "Starting the camera…"
          : state === "scanning"
            ? "Looking for a Sapience room code…"
            : state === "unrecognised"
              ? "That QR code isn't a Sapience room. Try the one on the room's invite card."
              : FALLBACK}
      </p>
    </div>
  );
}
