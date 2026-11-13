"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";

import { KeyboardArrowDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { selectClassName } from "./settings-card";

/**
 * Radio buttons drawn as a segmented control; the selected surface glides between options.
 * Native radios underneath, so arrow keys and the form behave as usual.
 */
export function Segmented<T extends string>({
  labelledBy,
  name,
  options,
  value,
  onChange,
}: {
  labelledBy: string;
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <LayoutGroup id={name}>
      <div role="radiogroup" aria-labelledby={labelledBy} className="flex min-h-10 gap-0.5 rounded-[10px] border bg-surface p-1">
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                "relative isolate inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center rounded-md px-3 text-[0.8125rem] font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 ease-(--ease-out) md:min-h-8",
                "has-checked:text-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring [@media(hover:hover)]:hover:text-foreground",
              )}
            >
              {checked ? (
                <motion.span
                  layoutId="pill"
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-md bg-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_1px_2px_rgb(0_0_0/0.2)] ring-1 ring-border"
                  transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.32, bounce: 0.12 }}
                />
              ) : null}
              <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
              {o.label}
            </label>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/** A native checkbox drawn as a switch: same role, name and keyboard behaviour as any checkbox. */
export function Switch({
  id,
  describedBy,
  checked,
  onChange,
}: {
  id: string;
  describedBy?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <span className="relative inline-flex h-6 w-10 shrink-0">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={describedBy}
        className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-full opacity-0"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-input transition-colors duration-200 ease-(--ease-out) peer-checked:bg-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-foreground shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-[translate,background-color] duration-200 ease-(--ease-out) peer-checked:translate-x-4 peer-checked:bg-background"
      />
    </span>
  );
}

export function SelectField<T extends string>({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const next = options.find((o) => o.value === e.target.value);
          if (next) onChange(next.value);
        }}
        className={selectClassName}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <KeyboardArrowDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4.5 -translate-y-1/2 text-faint" />
    </div>
  );
}
