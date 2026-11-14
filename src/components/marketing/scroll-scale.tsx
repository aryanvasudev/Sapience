"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const FROM = 0.84;

/*
 * Grows its children from a slightly smaller size to full size over the first stretch of page
 * scroll (the first ~60% of a viewport), anchored at the top edge so the content opens downward
 * toward the reader instead of jumping. Reduced motion shows it at full size.
 */
export function ScrollScale({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const scale = useTransform(scrollY, (y) =>
    y <= 0 ? FROM : FROM + (1 - FROM) * Math.min(1, y / (window.innerHeight * 0.6)),
  );

  return (
    <div className={cn(className)}>
      <motion.div style={reduce ? undefined : { scale, transformOrigin: "50% 0%" }} className="will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}
