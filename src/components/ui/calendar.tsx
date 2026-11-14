"use client";

import * as React from "react";
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker";

import { ChevronRightIcon, KeyboardArrowDownIcon } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Calendar, from shadcn/ui (radix-nova) on react-day-picker. Restyled for Sapience: the selected
 * day carries the highlighter yellow (the one accent), today gets a hairline ring, other months'
 * days recede to the faint text role, and weeks start on Monday like the study calendar.
 * Keyboard: arrow keys move by day and week, Page Up/Down by month, Home/End to the week's ends.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  weekStartsOn = 1,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const d = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={weekStartsOn}
      className={cn("group/calendar p-1 [--cell-size:--spacing(9)]", className)}
      classNames={{
        root: cn("w-fit", d.root),
        months: cn("relative flex flex-col gap-4", d.months),
        month: cn("flex w-full flex-col gap-3", d.month),
        nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between", d.nav),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-(--cell-size) rounded-lg p-0 text-muted-foreground select-none aria-disabled:opacity-40",
          d.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-(--cell-size) rounded-lg p-0 text-muted-foreground select-none aria-disabled:opacity-40",
          d.button_next,
        ),
        month_caption: cn("flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)", d.month_caption),
        caption_label: cn("text-sm font-medium select-none", d.caption_label),
        month_grid: cn("w-full border-collapse", d.month_grid),
        weekdays: cn("flex", d.weekdays),
        weekday: cn("flex-1 text-[0.75rem] font-normal text-faint select-none", d.weekday),
        week: cn("mt-1 flex w-full", d.week),
        day: cn("group/day relative aspect-square h-full w-full p-0 text-center select-none", d.day),
        today: cn(d.today),
        outside: cn(d.outside),
        disabled: cn("opacity-40", d.disabled),
        hidden: cn("invisible", d.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...rest }) => <div data-slot="calendar" ref={rootRef} className={cn(className)} {...rest} />,
        Chevron: ({ className, orientation, ...rest }) => {
          if (orientation === "left") return <ChevronRightIcon className={cn("size-4.5 rotate-180", className)} {...rest} />;
          if (orientation === "right") return <ChevronRightIcon className={cn("size-4.5", className)} {...rest} />;
          return <KeyboardArrowDownIcon className={cn("size-4", className)} {...rest} />;
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.isoDate}
      data-selected={modifiers.selected || undefined}
      data-today={modifiers.today || undefined}
      data-outside={modifiers.outside || undefined}
      className={cn(
        "relative flex size-(--cell-size) w-full items-center justify-center rounded-lg text-sm tabular-nums text-foreground outline-none",
        "transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:bg-accent",
        "data-outside:text-faint data-today:ring-1 data-today:ring-foreground/25 data-today:ring-inset",
        "data-selected:bg-brand data-selected:font-medium data-selected:text-brand-foreground data-selected:ring-0 [@media(hover:hover)]:data-selected:hover:bg-brand",
        "focus-visible:ring-[3px] focus-visible:ring-brand/30",
        "disabled:pointer-events-none",
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
