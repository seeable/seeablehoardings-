/**
 * Display formatting — one place, per docs/07 §25.
 *   - Currency: ₹ with Indian digit grouping (₹85,000 · ₹1,40,000).
 *   - Dates: absolute, month name (15 Sep 2026) — never numeric-only.
 *   - Relative time is supplementary only, never the sole form of a deadline.
 * Single-city MVP: everything is IST (docs/07 §28). Bare "YYYY-MM-DD" values
 * (DB `date` columns) are pinned to IST midnight so they render on the intended
 * calendar day; `timestamptz` values are rendered in IST.
 */

const IST = "Asia/Kolkata";

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** ₹85,000 — Indian grouping, no paise. `null`/`undefined` → "—". */
export function formatINR(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return INR.format(amount);
}

/** "₹85,000/month" from a price + DAY|WEEK|MONTH unit. */
export function formatPrice(
  amount: number | null | undefined,
  unit: "DAY" | "WEEK" | "MONTH" | null | undefined,
): string {
  const price = formatINR(amount);
  if (price === "—" || !unit) return price;
  return `${price}/${unit.toLowerCase()}`;
}

const PARTS = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: IST,
});

/** IST calendar parts for a Date. Month is normalised to 3 letters ("Sept" →
 *  "Sep") so output matches docs/07 §25 regardless of the runtime's CLDR. */
function istParts(d: Date): { day: string; month: string; year: string } {
  const p = Object.fromEntries(
    PARTS.formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { day: p.day, month: p.month.slice(0, 3), year: p.year };
}

/** A `date`/`timestamptz` string or Date → "15 Sep 2026". */
export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  const { day, month, year } = istParts(d);
  return `${day} ${month} ${year}`;
}

/** "15 Sep – 30 Sep 2026" (year shown once when both ends share it). */
export function formatDateRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): string {
  const a = toDate(start);
  const b = toDate(end);
  if (!a || !b) return "—";
  const pa = istParts(a);
  const pb = istParts(b);
  const left =
    pa.year === pb.year ? `${pa.day} ${pa.month}` : `${pa.day} ${pa.month} ${pa.year}`;
  return `${left} – ${pb.day} ${pb.month} ${pb.year}`;
}

/** "just now" / "5 min ago" / "3 h ago" / "2 days ago" — supplementary only. */
export function formatRelative(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  const d = toDate(value);
  if (!d) return "—";
  const secs = Math.round((now.getTime() - d.getTime()) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return formatDate(d);
}

/** A future deadline as "in 3 h" / "in 25 min" / "overdue". */
export function formatCountdown(
  deadline: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  const d = toDate(deadline);
  if (!d) return "—";
  const mins = Math.round((d.getTime() - now.getTime()) / 60000);
  if (mins <= 0) return "overdue";
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `in ${hours} h`;
  return `in ${Math.round(hours / 24)} days`;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00+05:30`)
    : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
