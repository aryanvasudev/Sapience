"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * A figure that tweens from 0 to its value once, when it first scrolls into view (adapted from
 * React Bits "CountUp", https://reactbits.dev). The final value is server-rendered, so it is
 * correct without JavaScript and for screen readers; only the visible digits animate.
 */
export function CountUp({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView || reduce || value === 0) return;
    const format = (n: number) => `${Math.round(n).toLocaleString("en-IN")}${suffix}`;
    const controls = animate(0, value, {
      duration: Math.min(1.2, 0.5 + value / 400),
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => {
        node.textContent = format(n);
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value, suffix]);

  return (
    <span ref={ref} className={className}>
      {`${value.toLocaleString("en-IN")}${suffix}`}
    </span>
  );
}
