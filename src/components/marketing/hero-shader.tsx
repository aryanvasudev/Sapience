"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useState } from "react";

import { cn } from "@/lib/utils";

/*
 * The landing page's one decorative moment: React Bits "Threads". Many lines leave the left edge as
 * a single bundle and fan out to the right, which is what Sapience does to a lecture: one video in,
 * chapters, notes and questions out. Ink-coloured lines; the frayed ends turn sapphire.
 *
 * - Loaded lazily on the client, so it never blocks first paint or ships in the server HTML.
 * - Reduced motion: Threads draws one still frame and stops.
 * - It renders no frames while the tab is hidden or the hero is scrolled out of view.
 * - Without WebGL2 a static SVG of the same fan is shown instead.
 * - The user asked for a shader here; it is the only looping motion in the product.
 */
const Threads = dynamic(() => import("@/components/reactbits/threads"), { ssr: false, loading: () => null });

export function HeroShader({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const [unavailable, setUnavailable] = useState(false);

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {unavailable ? (
        <StaticFan />
      ) : (
        <Threads
          // Remount on a theme switch so the line colours are re-read from the new CSS variables.
          key={resolvedTheme ?? "initial"}
          color="var(--shader-ink)"
          accentColor="var(--shader-accent)"
          lineCount={56}
          amplitude={1.35}
          distance={0.5}
          thickness={0.55}
          softness={0.45}
          speed={0.32}
          waves={0.9}
          split={0.18}
          fray={0.55}
          angle={-7}
          taper={0.8}
          brightness={0.95}
          opacity={resolvedTheme === "light" ? 0.5 : 0.8}
          fade={0.12}
          onUnavailable={() => setUnavailable(true)}
          className="opacity-100 transition-opacity duration-700 ease-(--ease-out) starting:opacity-0"
        />
      )}
    </div>
  );
}

/** A still drawing of the fan for browsers without WebGL2. */
function StaticFan() {
  const lines = Array.from({ length: 22 }, (_, i) => i / 21);
  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 1200 800" preserveAspectRatio="none" fill="none">
      {lines.map((t) => (
        <path
          key={t}
          d={`M0 ${470 + t * 18} C 360 ${470 + t * 18}, 620 ${300 + t * 260}, 1200 ${120 + t * 620}`}
          stroke={t > 0.7 ? "var(--shader-accent)" : "var(--shader-ink)"}
          strokeOpacity={0.05 + (1 - t) * 0.12}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
