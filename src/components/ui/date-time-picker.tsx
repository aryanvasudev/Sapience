"use client";

import { useMemo, useRef, useState } from "react";

import { CalendarMonthIcon } from "@/components/icons";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SelectField, type SelectOption } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/*
 * Date and time fields that replace <input type="date|time">, whose pickers are drawn by the
 * browser and ignore the theme. Values keep the native string formats ("YYYY-MM-DD" and "HH:MM",
 * local time), so form code that reads them does not change. Pass `name` and a hidden input
 * carries the value in a plain <form>.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" → a local Date at midnight, or undefined. */
function parseDay(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const formatDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeLabel = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

const FIELD =
  "flex h-10 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-[10px] border border-input bg-card px-3 text-left text-sm text-foreground outline-none select-none dark:bg-input/30 transition-[border-color,background-color,box-shadow] duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:bg-muted/60 dark:[@media(hover:hover)]:hover:bg-input/50 focus-visible:border-brand/60 focus-visible:ring-[3px] focus-visible:ring-brand/15 data-[state=open]:border-brand/60 data-[state=open]:ring-[3px] data-[state=open]:ring-brand/15";

export function DatePicker({
  id,
  name,
  value,
  onChange,
  placeholder = "Pick a date",
  clearable = false,
  className,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Show a "Clear" action, for optional dates. */
  clearable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const selected = parseDay(value);
  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" id={id} className={cn(FIELD, "h-11 md:h-10", className)}>
          <CalendarMonthIcon className="size-4.5 shrink-0 text-faint" />
          <span className={cn("truncate", !selected && "text-faint")}>{selected ? dayLabel.format(selected) : placeholder}</span>
        </button>
      </PopoverTrigger>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <PopoverContent
        ref={contentRef}
        className="w-auto"
        // Radix would focus the first button (previous month); start on the chosen day, or today,
        // so the arrow keys move through the grid straight away.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const grid = contentRef.current;
          const day =
            grid?.querySelector<HTMLButtonElement>("button[data-selected]") ?? grid?.querySelector<HTMLButtonElement>("button[data-today]");
          (day ?? grid?.querySelector<HTMLButtonElement>("[data-slot=calendar] button[data-day]"))?.focus();
        }}
      >
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) pick(formatDay(date));
          }}
        />
        <div className="mt-1 flex items-center justify-between border-t pt-2">
          <button
            type="button"
            onClick={() => pick(formatDay(new Date()))}
            className="h-8 rounded-lg px-2.5 text-[0.8125rem] text-muted-foreground transition-colors duration-150 ease-(--ease-out) outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-accent [@media(hover:hover)]:hover:text-foreground"
          >
            Today
          </button>
          {clearable && value ? (
            <button
              type="button"
              onClick={() => pick("")}
              className="h-8 rounded-lg px-2.5 text-[0.8125rem] text-muted-foreground transition-colors duration-150 ease-(--ease-out) outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-accent [@media(hover:hover)]:hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Every quarter hour of the day as "HH:MM", labelled in the reader's own clock (6:00 PM or 18:00). */
function timeOptions(current: string, step: number): SelectOption<string>[] {
  const values = new Set<string>();
  for (let minutes = 0; minutes < 24 * 60; minutes += step) values.add(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  if (/^\d{2}:\d{2}$/.test(current)) values.add(current);
  return [...values].sort().map((v) => {
    const [h, m] = v.split(":").map(Number);
    return { value: v, label: timeLabel.format(new Date(2000, 0, 1, h, m)) };
  });
}

export function TimePicker({
  id,
  name,
  value,
  onChange,
  step = 15,
  className,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  /** Minutes between options. A value off the grid (say 23:59) is kept as its own option. */
  step?: number;
  className?: string;
}) {
  const options = useMemo(() => timeOptions(value, step), [value, step]);
  return (
    <>
      <SelectField
        id={id}
        value={value}
        onValueChange={onChange}
        options={options}
        placeholder="Time"
        className={cn("h-11 bg-card tabular-nums md:h-10", className)}
        contentClassName="max-h-64"
      />
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </>
  );
}
