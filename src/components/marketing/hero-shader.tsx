"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useState } from "react";

import { cn } from "@/lib/utils";

/*
 * The landing page's two shaders, both from React Bits (https://reactbits.dev).
 *
 * - HeroRays ("Light Rays"): a projector beam falling from the top of a dark lecture hall onto the
 *   lesson window below. Chalk-white with a trace of warmth; it leans a little toward the cursor.
 * - ThreadsBackdrop ("Threads"): many lines leave the left edge as one bundle and fan out, which is
 *   what Sapience does to a lecture. Used once, behind the closing call to action.
 *
 * Both load lazily on the client, never block first paint, stop rendering while off screen or in
 * a hidden tab, and settle to a still frame with reduced motion.
 */
const LightRays = dynamic(() => import("@/components/reactbits/light-rays"), { ssr: false, loading: () => null });
const Threads = dynamic(() => import("@/components/reactbits/threads"), { ssr: false, loading: () => null });

export function HeroRays({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const light = resolvedTheme === "light";
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <LightRays
        key={resolvedTheme ?? "initial"}
        raysOrigin="top-center"
        raysColor={light ? "#6b5a2e" : "#fff6e3"}
        raysSpeed={0.6}
        lightSpread={0.62}
        rayLength={1.5}
        rayDensity={1.1}
        raySharpness={0.3}
        glow={0.5}
        haze={0.35}
        atmosphere={0.15}
        saturation={0.35}
        fadeDistance={1.1}
        followMouse
        mouseInfluence={0.06}
        cursorShadow={false}
        clickPulse={false}
        lightMode={light}
        opacity={0.9}
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
