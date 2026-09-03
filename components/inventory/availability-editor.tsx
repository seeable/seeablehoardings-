"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AvailabilityCalendar,
  type DayState,
} from "@/components/ui/availability-calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatDateRange } from "@/lib/format";
import { isWithin, todayIST, type ISODate } from "@/lib/date";
import {
  addBlock,
  getAvailability,
  removeBlock,
  type AvailabilityView,
} from "@/lib/inventory/client";
import { ApiClientError } from "@/lib/api/client";

/**
 * Shared availability management — the wizard's Step-5 pre-block panel and PB-05
 * in full (`showBookings`). Booked cells can't be selected (REQUEST-004 /
 * docs/04 PB-05); a selected available range → "Mark unavailable" → a block.
 */
export function AvailabilityEditor({
  hoardingId,
  showBookings = false,
}: {
  hoardingId: string;
  showBookings?: boolean;
}) {
  const toast = useToast();
  const today = todayIST();
  const [data, setData] = React.useState<AvailabilityView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [{ year, month }, setMonth] = React.useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m };
  });
  const [start, setStart] = React.useState<ISODate | null>(null);
  const [end, setEnd] = React.useState<ISODate | null>(null);
  const [reason, setReason] = React.useState("");
  const [nonce, setNonce] = React.useState(0);
  const load = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    getAvailability(hoardingId)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && toast.error("Couldn't load availability."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [hoardingId, nonce, toast]);

  const dayState = React.useCallback(
    (d: ISODate): Exclude<DayState, "past"> => {
      for (const r of data?.unavailable_ranges ?? []) {
        if (isWithin(d, r.start_date, r.end_date))
          return r.reason === "BOOKED" ? "booked" : "held";
      }
      return "available";
    },
    [data],
  );

  async function markUnavailable() {
    if (!start) return;
    setBusy(true);
    try {
      await addBlock(hoardingId, {
        start_date: start,
        end_date: end ?? start,
        reason: reason.trim() || undefined,
      });
      setStart(null);
      setEnd(null);
      setReason("");
      await load();
      toast.success("Dates blocked.");
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "Couldn't block those dates.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function unblock(blockId: string) {
    setBusy(true);
    try {
      await removeBlock(hoardingId, blockId);
      await load();
    } catch {
      toast.error("Couldn't unblock.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton className="h-80 w-full" />;

  return (
    <div className="space-y-4">
      <AvailabilityCalendar
        year={year}
        month={month}
        onMonthChange={(y, m) => setMonth({ year: y, month: m })}
        mode="select"
        dayState={dayState}
        selectedStart={start}
        selectedEnd={end}
        onSelect={(s, e) => {
          setStart(s);
          setEnd(e);
        }}
      />

      {start && (
        <div className="border-border flex flex-wrap items-end gap-3 rounded-lg border p-3">
          <div className="text-sm">
            <span className="text-ink-500">Selected: </span>
            {formatDateRange(start, end ?? start)}
          </div>
          <Input
            className="h-9 max-w-[14rem]"
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button size="sm" onClick={markUnavailable} loading={busy}>
            Mark unavailable
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setStart(null);
              setEnd(null);
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {(data?.blocks?.length ?? 0) > 0 && (
        <div>
          <p className="text-overline text-ink-500 mb-1">Blocked by you</p>
          <ul className="divide-border divide-y text-sm">
            {data!.blocks!.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span>
                  {formatDateRange(b.start_date, b.end_date)}
                  {b.reason && (
                    <span className="text-ink-500"> · {b.reason}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => unblock(b.id)}
                  aria-label="Unblock"
                  className="text-ink-500 hover:text-danger-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showBookings && (data?.bookings?.length ?? 0) > 0 && (
        <div>
          <p className="text-overline text-ink-500 mb-1">Upcoming bookings</p>
          <ul className="divide-border divide-y text-sm">
            {data!.bookings!.map((b, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span>{formatDateRange(b.start_date, b.end_date)}</span>
                <span className="text-ink-700">
                  {b.status[0] + b.status.slice(1).toLowerCase()}
                  {b.viewer_name ? ` · ${b.viewer_name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
