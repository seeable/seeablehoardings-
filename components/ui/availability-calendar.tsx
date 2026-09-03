"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type ISODate,
  addDays,
  isWithin,
  monthGrid,
  monthLabel,
  parseISO,
  shiftMonth,
  todayIST,
  WEEKDAY_LABELS,
} from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * Availability Calendar — docs/02 §10.6. Shared by PB-05 (Publisher edit) and
 * VW-03/VW-04 (Viewer read + select). Its cell states are the visual expression
 * of the REQUEST-004 no-overlap invariant.
 *
 *   available  selectable
 *   held       another Viewer has a pending request — hatched, not selectable
 *   booked     confirmed/live — not selectable
 *   past       before today (IST) — not selectable
 *
 * The caller supplies `dayState` (from `public_hoarding_detail.booked_ranges` /
 * `blocked_ranges`); "past" is computed here against `minDate` (default: today).
 */

export type DayState = "available" | "held" | "booked" | "past";

export interface AvailabilityCalendarProps {
  year: number;
  month: number; // 1-12
  onMonthChange: (year: number, month: number) => void;
  dayState?: (date: ISODate) => Exclude<DayState, "past">;
  mode?: "view" | "select";
  selectedStart?: ISODate | null;
  selectedEnd?: ISODate | null;
  onSelect?: (start: ISODate, end: ISODate | null) => void;
  /** Earliest selectable day; earlier days render as "past". Default today IST. */
  minDate?: ISODate;
}

const CELL_BASE =
  "relative flex h-10 items-center justify-center text-sm tabular-nums outline-none";

export function AvailabilityCalendar({
  year,
  month,
  onMonthChange,
  dayState,
  mode = "view",
  selectedStart = null,
  selectedEnd = null,
  onSelect,
  minDate,
}: AvailabilityCalendarProps) {
  const today = todayIST();
  const floor = minDate ?? today;
  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const cells = React.useMemo(() => monthGrid(year, month), [year, month]);
  const [focusedRaw, setFocused] = React.useState<ISODate>(
    () => selectedStart ?? firstOfMonth,
  );
  // Clamp the roving focus into the visible month during render (no effect):
  // when the month changes via props, focus falls back to the 1st; keyboard nav
  // sets a date that's already in the new month, so it's used as-is.
  const focused =
    parseISO(focusedRaw).month === month && parseISO(focusedRaw).year === year
      ? focusedRaw
      : firstOfMonth;

  function resolveState(date: ISODate): DayState {
    if (date < floor) return "past";
    return dayState ? dayState(date) : "available";
  }

  function handlePick(date: ISODate) {
    if (mode !== "select" || !onSelect) return;
    if (resolveState(date) !== "available") return;

    if (!selectedStart || selectedEnd || date < selectedStart) {
      onSelect(date, null);
      return;
    }
    // second click: commit the range only if every day in it is available
    let ok = true;
    for (let d = selectedStart; d <= date; d = addDays(d, 1)) {
      if (resolveState(d) !== "available") {
        ok = false;
        break;
      }
    }
    onSelect(ok ? selectedStart : date, ok ? date : null);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const map: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in map) {
      e.preventDefault();
      const next = addDays(focused, map[e.key]);
      setFocused(next);
      const p = parseISO(next);
      if (p.month !== month || p.year !== year) onMonthChange(p.year, p.month);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handlePick(focused);
    }
  }

  const prev = () => {
    const { year: y, month: m } = shiftMonth(year, month, -1);
    onMonthChange(y, m);
  };
  const next = () => {
    const { year: y, month: m } = shiftMonth(year, month, 1);
    onMonthChange(y, m);
  };

  return (
    <div className="border-border bg-surface-1 w-full rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous month"
          className="text-ink-700 hover:bg-surface-2 rounded-md p-1"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-h4 text-ink-900" aria-live="polite">
          {monthLabel(year, month)}
        </div>
        <button
          type="button"
          onClick={next}
          aria-label="Next month"
          className="text-ink-700 hover:bg-surface-2 rounded-md p-1"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div
        role="grid"
        aria-label={`${monthLabel(year, month)} availability`}
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-0.5"
      >
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            role="columnheader"
            className="text-ink-500 flex h-7 items-center justify-center text-[11px] font-semibold"
          >
            {d}
          </div>
        ))}

        {cells.map(({ date, inMonth }) => {
          const state = resolveState(date);
          const day = parseISO(date).day;
          const inRange =
            !!selectedStart &&
            isWithin(date, selectedStart, selectedEnd ?? selectedStart);
          const isEnd =
            date === selectedStart || (selectedEnd != null && date === selectedEnd);
          const selectable = mode === "select" && state === "available" && inMonth;

          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              tabIndex={date === focused ? 0 : -1}
              disabled={!selectable && mode === "select"}
              aria-disabled={!selectable || undefined}
              aria-label={`${date}${state !== "available" ? `, ${state}` : ""}`}
              aria-pressed={mode === "select" ? isEnd : undefined}
              title={state === "booked" ? "Booked" : undefined}
              onFocus={() => setFocused(date)}
              onClick={() => handlePick(date)}
              className={cn(
                CELL_BASE,
                "rounded-md",
                !inMonth && "opacity-30",
                state === "available" && "bg-surface-1 text-ink-900",
                state === "past" && "bg-surface-2 text-ink-300",
                state === "booked" && "bg-ink-300 text-ink-500",
                state === "held" && "bg-warning-50 text-warning-700",
                inRange && "bg-gold-100 text-gold-800",
                isEnd && inRange && "ring-gold-700 z-10 font-semibold ring-2",
                selectable && "hover:bg-surface-2 cursor-pointer",
                "focus-visible:ring-gold-700 focus-visible:ring-2",
              )}
            >
              {state === "held" && (
                <span
                  className="bg-hatch pointer-events-none absolute inset-0 rounded-md opacity-40"
                  aria-hidden
                />
              )}
              <span className="relative">{day}</span>
            </button>
          );
        })}
      </div>

      <Legend mode={mode} />
    </div>
  );
}

function Legend({ mode }: { mode: "view" | "select" }) {
  const items: [string, string][] = [
    ["bg-surface-1 border border-border", "Available"],
    ["bg-warning-50 bg-hatch", "Requested"],
    ["bg-ink-300", "Booked"],
    ["bg-surface-2", "Past"],
  ];
  if (mode === "select") items.push(["bg-gold-100 ring-1 ring-gold-700", "Your selection"]);
  return (
    <ul className="text-ink-700 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
      {items.map(([cls, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={cn("h-3 w-3 rounded-sm", cls)} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}
