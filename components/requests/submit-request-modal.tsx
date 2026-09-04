"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CalendarDays } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/card";
import { VerifiedBadge } from "@/components/ui/badge";
import {
  AvailabilityCalendar,
  type DayState,
} from "@/components/ui/availability-calendar";
import { createRequest } from "@/lib/requests/client";
import { emitAnalyticsEvent } from "@/lib/analytics/client";
import { REQUEST_SLA_HOURS } from "@/lib/requests/types";
import { ApiClientError } from "@/lib/api/client";
import { formatDateRange, formatPrice } from "@/lib/format";
import { isWithin, todayIST, type ISODate } from "@/lib/date";
import type { PublicHoardingDetail } from "@/lib/discovery/types";

type Phase = "form" | "submitting" | "success" | "conflict" | "duplicate" | "gone";

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * VW-04 Submit Request (docs/03 VW-04). A single-decision modal / bottom sheet.
 * `REQUEST_DATE_CONFLICT` is a first-class, non-alarming state — "just booked by
 * another advertiser" with "Choose different dates" that reopens the calendar
 * and keeps the typed message (REQUEST-004 is why this state is designed, not an
 * afterthought). No Viewer contact field is collected (§23.4).
 */
export function SubmitRequestModal({
  hoarding,
  open,
  onClose,
  initialStart,
  initialEnd,
}: {
  hoarding: PublicHoardingDetail;
  open: boolean;
  onClose: () => void;
  initialStart: ISODate | null;
  initialEnd: ISODate | null;
}) {
  const router = useRouter();
  const today = todayIST();
  const idemKey = React.useRef(newKey());

  const [start, setStart] = React.useState<ISODate | null>(initialStart);
  const [end, setEnd] = React.useState<ISODate | null>(initialEnd);
  const [message, setMessage] = React.useState("");
  const [editingDates, setEditingDates] = React.useState(!initialStart);
  const [phase, setPhase] = React.useState<Phase>("form");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [existingId, setExistingId] = React.useState<string | null>(null);
  const [{ year, month }, setMonth] = React.useState(() => {
    const [y, m] = (initialStart ?? today).split("-").map(Number);
    return { year: y, month: m };
  });

  React.useEffect(() => {
    if (open) void emitAnalyticsEvent("REQUEST_STARTED", { hoarding_id: hoarding.id });
  }, [open, hoarding.id]);

  const dayState = React.useCallback(
    (d: ISODate): Exclude<DayState, "past"> => {
      for (const r of hoarding.booked_ranges)
        if (isWithin(d, r.start_date, r.end_date)) return "booked";
      for (const r of hoarding.blocked_ranges)
        if (isWithin(d, r.start_date, r.end_date)) return "held";
      return "available";
    },
    [hoarding.booked_ranges, hoarding.blocked_ranges],
  );

  const rangeInvalid =
    !start ||
    !end ||
    end < start ||
    end < today ||
    // any day in the selection is booked/held
    (() => {
      for (let d = start; d <= end; ) {
        if (dayState(d) !== "available") return true;
        const [y, m, day] = d.split("-").map(Number);
        d = new Date(Date.UTC(y, m - 1, day + 1)).toISOString().slice(0, 10);
      }
      return false;
    })();

  async function submit() {
    if (rangeInvalid || !start || !end) return;
    setPhase("submitting");
    setErrorMsg(null);
    try {
      await createRequest({
        hoarding_id: hoarding.id,
        start_date: start,
        end_date: end,
        message: message.trim() || undefined,
        idempotencyKey: idemKey.current,
      });
      void emitAnalyticsEvent("REQUEST_SUBMITTED", { hoarding_id: hoarding.id });
      setPhase("success");
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.code === "REQUEST_DATE_CONFLICT") {
          setPhase("conflict");
          return;
        }
        if (e.code === "REQUEST_DUPLICATE_PENDING") {
          setExistingId(
            (e.details.existing_request_id as string | undefined) ?? null,
          );
          setPhase("duplicate");
          return;
        }
        if (
          e.code === "HOARDING_NOT_FOUND" ||
          e.code === "HOARDING_NOT_VISIBLE"
        ) {
          setPhase("gone");
          return;
        }
        setErrorMsg(e.message);
      } else {
        setErrorMsg("Something went wrong. Your message was kept — try again.");
      }
      setPhase("form");
    }
  }

  function chooseDifferentDates() {
    idemKey.current = newKey();
    setStart(null);
    setEnd(null);
    setEditingDates(true);
    setPhase("form");
  }

  const publisherName = hoarding.publisher.business_name ?? "the Publisher";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        phase === "success" ? "Request sent" : `Request ${hoarding.title}`
      }
    >
      <div className="space-y-4 p-4" aria-live="polite">
        {phase === "success" ? (
          <div className="space-y-3 py-4 text-center">
            <span className="bg-success-50 text-success-700 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
              <Check className="h-6 w-6" strokeWidth={3} />
            </span>
            <p className="text-ink-900 font-semibold">
              Request sent to {publisherName}
            </p>
            <p className="text-ink-500 text-sm">
              You&apos;ll be notified when they respond — usually within{" "}
              {REQUEST_SLA_HOURS} hours.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="secondary" onClick={onClose}>
                Done
              </Button>
              <Button onClick={() => router.push("/requests")}>
                View in My Requests
              </Button>
            </div>
          </div>
        ) : phase === "gone" ? (
          <div className="space-y-3">
            <Alert tone="warning">
              This listing is no longer available for requests.
            </Alert>
            <Button block variant="secondary" onClick={onClose}>
              Back
            </Button>
          </div>
        ) : phase === "duplicate" ? (
          <div className="space-y-3">
            <Alert tone="info">
              You already have a pending request on this listing.
            </Alert>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
              <Button
                onClick={() =>
                  router.push(
                    existingId ? `/requests?open=${existingId}` : "/requests",
                  )
                }
              >
                View my request
              </Button>
            </div>
          </div>
        ) : phase === "conflict" ? (
          <div className="space-y-3">
            <Alert tone="warning">
              These dates were just booked by another advertiser.
              {message.trim() && " Your message wasn't sent."}
            </Alert>
            <p className="text-ink-500 text-sm">
              Pick a different range and we&apos;ll send your request with the
              same message.
            </p>
            <Button block onClick={chooseDifferentDates}>
              Choose different dates
            </Button>
          </div>
        ) : (
          <>
            <div className="border-border rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-ink-500 text-xs">Requested dates</p>
                  <p className="text-ink-900 text-sm font-medium">
                    {start && end
                      ? formatDateRange(start, end)
                      : "Select a start and end date"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingDates((v) => !v)}
                >
                  <CalendarDays className="h-4 w-4" />
                  {editingDates ? "Hide" : "Edit dates"}
                </Button>
              </div>
              {editingDates && (
                <div className="mt-3">
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
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="request-message"
                className="text-ink-700 mb-1 block text-sm font-medium"
              >
                Message to {publisherName}{" "}
                <span className="text-ink-500 font-normal">(optional)</span>
              </label>
              <Textarea
                id="request-message"
                rows={3}
                maxLength={1000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Launching a skincare brand campaign, flexible on the exact start by a few days."
              />
            </div>

            <div className="border-border text-ink-700 rounded-lg border border-dashed p-3 text-sm">
              <p className="text-ink-900 font-medium">{hoarding.title}</p>
              <p className="flex items-center gap-1.5">
                {publisherName}
                {hoarding.publisher.is_verified && <VerifiedBadge />}
              </p>
              <p>{formatPrice(hoarding.price, hoarding.price_unit)}</p>
            </div>

            {errorMsg && <Alert tone="danger">{errorMsg}</Alert>}

            <Button
              block
              loading={phase === "submitting"}
              disabled={rangeInvalid}
              onClick={submit}
            >
              Send Request
            </Button>
            <p className="text-ink-500 text-[11px]">
              This sends an interest request — it doesn&apos;t charge you or
              guarantee the booking. {publisherName} will confirm availability
              and pricing directly.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
