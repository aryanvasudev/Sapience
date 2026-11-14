"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

import { ArrowBackIcon, ArrowForwardIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { addDays, formatLongDay, formatMonth, fromDayKey, monthGrid, monthOf, shiftMonth, type MonthView } from "../days";

export type DayMarks = { sessions: number; deadlines: number; revision: number };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function describe(key: string, marks: DayMarks | undefined, today: string): string {
  const parts = [formatLongDay(key)];
  if (key === today) parts.unshift("Today,");
  if (marks?.sessions) parts.push(`${marks.sessions} ${marks.sessions === 1 ? "session" : "sessions"}`);
  if (marks?.deadlines) parts.push(`${marks.deadlines} room ${marks.deadlines === 1 ? "deadline" : "deadlines"}`);
  if (marks?.revision) parts.push(`${marks.revision} ${marks.revision === 1 ? "concept" : "concepts"} due`);
  return parts.join(", ");
}

/**
 * A Monday-first month as a grid of day buttons. One day is tabbable at a time (the selected one);
 * arrow keys move by day and week, Home/End to the week's ends, Page Up/Down by month.
 */
export function MonthGrid({
  view,
  selected,
  today,
  marks,
  onSelect,
  onViewChange,
}: {
  view: MonthView;
  selected: string;
  today: string;
  marks: Map<string, DayMarks>;
  onSelect: (key: string) => void;
  onViewChange: (view: MonthView) => void;
}) {
  const days = monthGrid(view);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const focusNext = useRef(false);

  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    buttons.current.get(selected)?.focus();
  }, [selected, view]);

  const move = (key: string) => {
    focusNext.current = true;
    const target = monthOf(key);
    if (target.year !== view.year || target.month !== view.month) onViewChange(target);
    onSelect(key);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const weekday = (fromDayKey(selected).getDay() + 6) % 7;
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(selected, -1),
      ArrowRight: () => addDays(selected, 1),
      ArrowUp: () => addDays(selected, -7),
      ArrowDown: () => addDays(selected, 7),
      Home: () => addDays(selected, -weekday),
      End: () => addDays(selected, 6 - weekday),
      PageUp: () => shiftDay(selected, -1),
      PageDown: () => shiftDay(selected, 1),
    };
    const next = moves[event.key];
    if (!next) return;
    event.preventDefault();
    move(next());
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <h2 className="mr-auto text-[0.9375rem] font-medium" aria-live="polite">
          {formatMonth(view)}
        </h2>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => {
            onViewChange(monthOf(today));
            onSelect(today);
          }}
        >
          Today
        </Button>
        <Button type="button" size="icon-sm" variant="outline" aria-label="Previous month" onClick={() => onViewChange(shiftMonth(view, -1))}>
          <ArrowBackIcon className="size-4" />
        </Button>
        <Button type="button" size="icon-sm" variant="outline" aria-label="Next month" onClick={() => onViewChange(shiftMonth(view, 1))}>
          <ArrowForwardIcon className="size-4" />
        </Button>
      </div>

      <div role="grid" aria-label={formatMonth(view)} onKeyDown={onKeyDown} className="grid gap-1">
        <div role="row" className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div key={d} role="columnheader" className="pb-1 text-center text-[0.75rem] text-faint">
              {d}
            </div>
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5].map((week) => (
          <div key={week} role="row" className="grid grid-cols-7 gap-1">
            {days.slice(week * 7, week * 7 + 7).map((key) => {
              const date = fromDayKey(key);
              const inMonth = date.getMonth() === view.month;
              const isSelected = key === selected;
              const isToday = key === today;
              const m = marks.get(key);
              // The selected day is tabbable; if it's outside this month, the 1st takes its place.
              const tabbable = isSelected || (!days.includes(selected) && key === firstOfMonth(view));
              return (
                <div key={key} role="gridcell" aria-selected={isSelected}>
                  <button
                    ref={(el) => {
                      if (el) buttons.current.set(key, el);
                      else buttons.current.delete(key);
                    }}
                    type="button"
                    tabIndex={tabbable ? 0 : -1}
                    aria-label={describe(key, m, today)}
                    aria-current={isToday ? "date" : undefined}
                    onClick={() => onSelect(key)}
                    className={cn(
                      "relative flex h-12 w-full flex-col items-center justify-between rounded-[10px] pt-1.5 pb-2 outline-none transition-[background-color,color,box-shadow] duration-150 ease-(--ease-out) focus-visible:ring-2 focus-visible:ring-ring sm:h-16 sm:items-start sm:px-2",
                      inMonth ? "text-foreground" : "text-faint",
                      isSelected
                        ? "bg-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] ring-1 ring-border"
                        : "[@media(hover:hover)]:hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full font-mono text-[0.75rem] tabular-nums",
                        isToday && "font-medium text-foreground ring-[1.5px] ring-brand",
                      )}
                    >
                      {date.getDate()}
                    </span>
                    <span aria-hidden className="flex h-1.5 items-center gap-1">
                      {m?.sessions ? <span className="size-1.5 rounded-full bg-foreground" /> : null}
                      {m?.deadlines ? <span className="size-1.5 rounded-full bg-brand" /> : null}
                      {m?.revision ? <span className="size-1.5 rounded-full bg-muted-foreground/45" /> : null}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-muted-foreground">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
          Study session
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-brand" />
          Room deadline
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground/45" />
          Revision due
        </li>
      </ul>
    </div>
  );
}

const firstOfMonth = (view: MonthView) => `${view.year}-${String(view.month + 1).padStart(2, "0")}-01`;

/** The same day of the month in the next/previous month, clamped to that month's length. */
function shiftDay(key: string, months: number): string {
  const date = fromDayKey(key);
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), last));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}
