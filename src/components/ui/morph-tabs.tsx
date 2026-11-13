"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A segmented tab list whose selected surface glides to the tab you pick instead of jumping
 * (a shared-layout morph). Use inside a Radix <Tabs>; pass the same `value` the Tabs is controlled
 * with so the pill knows where to sit.
 */
export function MorphTabsList({
  value,
  items,
  className,
}: {
  value: string;
  items: { value: string; label: ReactNode; icon?: ReactNode }[];
  className?: string;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <LayoutGroup id={id}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        className={cn("flex h-10 w-full items-center gap-0.5 rounded-[10px] border bg-surface p-1", className)}
      >
        {items.map((item) => {
          const active = item.value === value;
          return (
            <TabsPrimitive.Trigger
              key={item.value}
              value={item.value}
              className={cn(
                "relative isolate inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-[0.8125rem] font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 ease-(--ease-out) outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:text-foreground data-[state=active]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="pill"
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-md bg-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_1px_2px_rgb(0_0_0/0.2)] ring-1 ring-border"
                  transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.32, bounce: 0.12 }}
                />
              ) : null}
              {item.icon}
              {item.label}
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>
    </LayoutGroup>
  );
}
