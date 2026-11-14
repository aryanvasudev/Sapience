"use client";

import { Select as SelectPrimitive } from "radix-ui";
import * as React from "react";

import { CheckIcon, KeyboardArrowDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Select, from shadcn/ui (radix-nova) on Radix Select. Restyled for Sapience so a closed select
 * reads like the inputs (same height, border and brand focus ring) and an open one like the
 * dropdown menus (raised panel, hairline ring, soft shadow, quick ease-out scale from the trigger).
 * Native <select> is not used anywhere: its open list is drawn by the OS and ignores the theme.
 *
 * Most screens want `SelectField` at the bottom of this file rather than the parts.
 */
function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" className={cn("scroll-my-1", className)} {...props} />;
}

function SelectValue(props: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "group/select flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-input bg-transparent pr-2.5 pl-3 text-left text-sm whitespace-nowrap text-foreground outline-none select-none dark:bg-input/30",
        "transition-[border-color,background-color,box-shadow] duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:bg-muted/60 dark:[@media(hover:hover)]:hover:bg-input/50",
        "focus-visible:border-brand/60 focus-visible:ring-[3px] focus-visible:ring-brand/15 data-[state=open]:border-brand/60 data-[state=open]:ring-[3px] data-[state=open]:ring-brand/15",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
        "data-placeholder:text-faint *:data-[slot=select-value]:truncate",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <KeyboardArrowDownIcon className="pointer-events-none size-4.5 shrink-0 text-faint transition-transform duration-200 ease-(--ease-out) group-data-[state=open]/select:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={sideOffset}
        className={cn(
          "relative z-50 max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-[0_16px_48px_-12px_rgb(0_0_0/0.45)] ring-1 ring-foreground/10",
          "duration-150 ease-(--ease-out) data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97] data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className="scroll-py-1 p-1">{children}</SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label data-slot="select-label" className={cn("px-2.5 pt-2 pb-1 text-xs text-faint", className)} {...props} />
  );
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg py-1.5 pr-9 pl-2.5 text-sm text-muted-foreground outline-hidden select-none",
        "focus:bg-accent focus:text-foreground data-[state=checked]:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="pointer-events-none absolute right-2.5 flex size-4 items-center justify-center text-brand">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn("flex h-6 cursor-default items-center justify-center text-faint", className)}
      {...props}
    >
      <KeyboardArrowDownIcon className="size-4 rotate-180" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn("flex h-6 cursor-default items-center justify-center text-faint", className)}
      {...props}
    >
      <KeyboardArrowDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

export type SelectOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  /** Shown in the closed trigger instead of `label`, e.g. a shorter title. */
  triggerLabel?: React.ReactNode;
  /** Draw a divider above this option, to set apart an action like "Paste a link…". */
  separated?: boolean;
};

// Radix reserves the empty string for "nothing selected", so an option whose value is "" (a
// common "none" choice) travels through Radix under this stand-in and comes back out as "".
const EMPTY = "__empty__";

/**
 * A complete select: trigger, menu and options from a list. Use it in place of <select>.
 * Pair it with a <label htmlFor={id}> or pass `aria-label`.
 */
function SelectField<T extends string>({
  id,
  value,
  options,
  onValueChange,
  placeholder,
  disabled,
  className,
  contentClassName,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: {
  id?: string;
  value: T;
  options: readonly SelectOption<T>[];
  onValueChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Select
      value={value === "" ? EMPTY : value}
      onValueChange={(next) => {
        const raw = next === EMPTY ? "" : next;
        const option = options.find((o) => o.value === raw);
        if (option) onValueChange(option.value);
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} aria-invalid={ariaInvalid} className={className}>
        <SelectValue placeholder={placeholder}>{current ? (current.triggerLabel ?? current.label) : null}</SelectValue>
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((o) => (
          <React.Fragment key={o.value || EMPTY}>
            {o.separated ? <SelectSeparator /> : null}
            <SelectItem value={o.value === "" ? EMPTY : o.value}>{o.label}</SelectItem>
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  );
}

export {
  Select,
  SelectContent,
  SelectField,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
