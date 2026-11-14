"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/**
 * A QR code for `value`, drawn as an SVG data URL (the CSP allows `img-src data:`). Always ink on
 * white with a quiet zone, whatever the theme, so every phone camera can read it.
 */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#111111", light: "#ffffff" } })
      .then((svg) => {
        if (!cancelled) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div className={className}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a generated data URL, nothing to optimise
        <img src={src} alt={label} className="aspect-square w-full animate-fade rounded-xl bg-white [image-rendering:pixelated]" />
      ) : (
        <div aria-hidden className="aspect-square w-full animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
      )}
    </div>
  );
}
