"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * A label that morphs when its text changes: the old words blur out as the new ones blur in, so a
 * button going from "Build lesson" to "Checking the video…" reads as one control changing state
 * rather than two labels swapping (Emil Kowalski: blur bridges a crossfade). The width animates
 * with the text so the button resizes smoothly.
 */
export function MorphText({ children, className }: { children: string; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span layout={!reduce} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className={cn("relative inline-grid", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={children}
          className="col-start-1 row-start-1 whitespace-nowrap"
          initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)", y: 4 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)", y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)", y: -4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}
