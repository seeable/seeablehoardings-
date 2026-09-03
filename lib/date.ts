/**
 * Calendar-grid date helpers for the Availability Calendar (docs/02 §10.6).
 *
 * Everything works on plain "YYYY-MM-DD" strings — the same shape the DB `date`
 * columns use — so there is no timezone drift. The MVP is single-city IST
 * (docs/07 §28); "today" is computed in IST.
 */

export type ISODate = string; // "2026-09-15"

const pad = (n: number) => String(n).padStart(2, "0");

/** Build an ISODate from year / month (1-12) / day. */
export function isoDate(year: number, month: number, day: number): ISODate {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Today in IST, as an ISODate. */
export function todayIST(now: Date = new Date()): ISODate {
  // en-CA renders ISO-style "YYYY-MM-DD".
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(now);
}

/** Parse "YYYY-MM-DD" → { year, month (1-12), day }. */
export function parseISO(d: ISODate): { year: number; month: number; day: number } {
  const [year, month, day] = d.split("-").map(Number);
  return { year, month, day };
}

/** Days in a given month (1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Day of week for an ISODate: 0 = Sunday … 6 = Saturday. */
export function weekday(d: ISODate): number {
  const { year, month, day } = parseISO(d);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Add (or subtract) whole days, returning an ISODate. */
export function addDays(d: ISODate, delta: number): ISODate {
  const { year, month, day } = parseISO(d);
  const t = new Date(Date.UTC(year, month - 1, day + delta));
  return isoDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Shift a month by ±1, returning { year, month }. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const zero = month - 1 + delta;
  return {
    year: year + Math.floor(zero / 12),
    month: (((zero % 12) + 12) % 12) + 1,
  };
}

/** Inclusive comparison helpers on ISODate strings (lexicographic works). */
export const isBefore = (a: ISODate, b: ISODate) => a < b;
export const isAfter = (a: ISODate, b: ISODate) => a > b;
export const isSameDay = (a: ISODate, b: ISODate) => a === b;

/** Is `d` within [start, end] inclusive (order-independent)? */
export function isWithin(d: ISODate, start: ISODate, end: ISODate): boolean {
  const lo = start <= end ? start : end;
  const hi = start <= end ? end : start;
  return d >= lo && d <= hi;
}

/** Every ISODate in [start, end] inclusive. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const lo = start <= end ? start : end;
  const hi = start <= end ? end : start;
  const out: ISODate[] = [];
  for (let cur = lo; cur <= hi; cur = addDays(cur, 1)) out.push(cur);
  return out;
}

export interface MonthCell {
  date: ISODate;
  /** False for the leading/trailing days that pad the grid to whole weeks. */
  inMonth: boolean;
}

/**
 * A 6×7 grid of cells for `month` (1-12), weeks starting Monday, padded with
 * the adjacent months' days so every row is full.
 */
export function monthGrid(year: number, month: number): MonthCell[] {
  const first = isoDate(year, month, 1);
  // JS getUTCDay: 0=Sun. Shift so Monday = 0.
  const lead = (weekday(first) + 6) % 7;
  const start = addDays(first, -lead);
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    return { date, inMonth: parseISO(date).month === month };
  });
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "September 2026" */
export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
