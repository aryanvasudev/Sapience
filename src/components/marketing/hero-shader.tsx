"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useState } from "react";

import { cn } from "@/lib/utils";

/*
 * The landing page's two shaders, both from React Bits (https://reactbits.dev).
 *
 * - HeroWaves ("Gradient Waves"): dark graphite swells rolling in under the headline, their crests
 *   catching the highlighter yellow. The light leans a little toward the cursor.
 * - ThreadsBackdrop ("Threads"): many lines leave the left edge as one bundle and fan out, which is
 *   what Sapience does to a lecture. Used once, behind the closing call to action.
 *
 * Both load lazily on the client, never block first paint, stop rendering while off screen or in
 * a hidden tab, and settle to a still frame with reduced motion.
 */
const GradientWaves = dynamic(() => import("@/components/reactbits/gradient-waves"), { ssr: false, loading: () => null });
const Threads = dynamic(() => import("@/components/reactbits/threads"), { ssr: false, loading: () => null });

export function HeroWaves({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const light = resolvedTheme === "light";
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <GradientWaves
        key={resolvedTheme ?? "initial"}
        horizonColor={light ? "#d8d2c3" : "#34322d"}
        waveColor={light ? "#f3f0e8" : "#161618"}
        crestColor={light ? "#c08f00" : "#f5cf4a"}
        lightMode={light}
        speed={0.6}
        maxAspect={1.6}
        brightness={light ? 1 : 1.3}
        swellOnClick={false}
        className="opacity-100 transition-opacity duration-1000 ease-(--ease-out) starting:opacity-0"
      />
    </div>
  );
}

export function ThreadsBackdrop({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const [unavailable, setUnavailable] = useState(false);
  if (unavailable) return null;
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <Threads
        key={resolvedTheme ?? "initial"}
        color="var(--shader-ink)"
        accentColor="var(--shader-accent)"
        lineCount={48}
        amplitude={1.2}
        distance={0.45}
        thickness={0.5}
        softness={0.5}
        speed={0.26}
        waves={0.9}
        split={0.2}
        fray={0.6}
        angle={-6}
        taper={0.8}
        brightness={0.9}
        opacity={resolvedTheme === "light" ? 0.45 : 0.7}
        fade={0.14}
        onUnavailable={() => setUnavailable(true)}
        className="opacity-100 transition-opacity duration-700 ease-(--ease-out) starting:opacity-0"
      />
    </div>
  );
}
