"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  AvailabilityCalendar,
  type DayState,
} from "@/components/ui/availability-calendar";
import { PhotoCarousel } from "@/components/discovery/photo-carousel";
import { formatPrice, formatDate, formatDateRange } from "@/lib/format";
import { isWithin, todayIST, type ISODate } from "@/lib/date";
import { humanizeAttributeKey } from "@/lib/inventory/attributes";
import type { PublicHoardingDetail } from "@/lib/discovery/types";

const SI_LABEL: Record<string, string> = {
  traffic_volume: "Traffic volume",
  visibility_rating: "Visibility rating",
  nearby_landmarks: "Nearby landmarks",
};
const titleCase = (s: string) =>
  s.length <= 3 ? s : s[0] + s.slice(1).toLowerCase();

/**
 * VW-03 Hoarding Detail. Public projection only — Publisher name is a label,
 * never a link (disintermediation). A valid calendar selection changes the CTA
 * label; the request itself is wired in Phase 7.
 */
export function DetailView({ hoarding: h }: { hoarding: PublicHoardingDetail }) {
  const toast = useToast();
  const today = todayIST();
  const [{ year, month }, setMonth] = React.useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m };
  });
  const [start, setStart] = React.useState<ISODate | null>(null);
  const [end, setEnd] = React.useState<ISODate | null>(null);

  const dayState = React.useCallback(
    (d: ISODate): Exclude<DayState, "past"> => {
      for (const r of h.booked_ranges)
        if (isWithin(d, r.start_date, r.end_date)) return "booked";
      for (const r of h.blocked_ranges)
        if (isWithin(d, r.start_date, r.end_date)) return "held";
      return "available";
    },
    [h.booked_ranges, h.blocked_ranges],
  );

  const fullyBooked = h.availability_summary.next_available_date === null;
  const si = h.site_intelligence;
  const attrs = Object.entries(h.attributes).filter(
    ([, v]) => v !== null && v !== "" && v !== undefined,
  );

  const ctaLabel =
    start && end
      ? `Request ${formatDateRange(start, end)}`
      : "Request this hoarding";

  return (
    <div className="mx-auto max-w-5xl pb-24 lg:pb-8">
      <Link
        href="/discover"
        className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Discover
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <PhotoCarousel images={h.media} title={h.title} />

          <div>
            <h1 className="text-h1 text-ink-900">{h.title}</h1>
            <p className="text-ink-700 mt-1 flex items-center gap-1.5 text-sm">
              <MapPin className="h-4 w-4" aria-hidden />
              {[h.location.address_text, h.location.locality, h.location.city]
                .filter(Boolean)
                .join(", ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip>{h.type.display_name}</Chip>
              {h.size && <Chip>{h.size}</Chip>}
            </div>
          </div>

          {si && (
            <section>
              <h2 className="text-overline text-ink-500 mb-2">
                Site intelligence
              </h2>
              <dl className="divide-border divide-y text-sm">
                {Object.entries(si).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2">
                    <dt className="text-ink-500">{SI_LABEL[k] ?? humanizeAttributeKey(k)}</dt>
                    <dd className="text-ink-900 text-right">
                      {typeof v === "string" ? titleCase(v) : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
              {!h.site_intelligence_complete && (
                <p className="text-ink-500 mt-1 text-xs">
                  Some details weren&apos;t provided by the Publisher.
                </p>
              )}
            </section>
          )}

          {attrs.length > 0 && (
            <section>
              <h2 className="text-overline text-ink-500 mb-2">Specifications</h2>
              <dl className="divide-border divide-y text-sm">
                {attrs.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2">
                    <dt className="text-ink-500">{humanizeAttributeKey(k)}</dt>
                    <dd className="text-ink-900 text-right">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {h.description && (
            <section>
              <h2 className="text-overline text-ink-500 mb-2">About this hoarding</h2>
              <p className="text-ink-800 text-sm whitespace-pre-line">
                {h.description}
              </p>
            </section>
          )}

          <section>
            <h2 className="text-overline text-ink-500 mb-2">Availability</h2>
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
          </section>
        </div>

        {/* Desktop sticky summary */}
        <aside className="hidden lg:block">
          <div className="border-border bg-surface-1 sticky top-20 space-y-3 rounded-lg border p-4 shadow-sm">
            <p className="text-ink-900 text-xl font-semibold">
              {formatPrice(h.price, h.price_unit)}
            </p>
            <p className="text-ink-500 flex items-center gap-1.5 text-sm">
              {h.publisher.business_name ?? "SEEABLE Publisher"}
              {h.publisher.is_verified && <VerifiedBadge />}
            </p>
            {fullyBooked ? (
              <Alert tone="info">Fully booked for the next few months.</Alert>
            ) : (
              <>
                <p className="text-ink-500 text-xs">
                  Next available{" "}
                  {formatDate(h.availability_summary.next_available_date)}
                </p>
                <Button
                  block
                  disabled={!start}
                  onClick={() =>
                    toast.info("Requesting a hoarding arrives in Phase 7.")
                  }
                >
                  {ctaLabel}
                </Button>
                <p className="text-ink-500 text-[11px]">
                  This sends an interest request — it doesn&apos;t charge you or
                  guarantee the booking.
                </p>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile sticky CTA */}
      <div className="border-border bg-surface-1 fixed inset-x-0 bottom-14 z-20 flex items-center gap-3 border-t p-3 lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-ink-900 text-sm font-semibold">
            {formatPrice(h.price, h.price_unit)}
          </p>
        </div>
        {fullyBooked ? (
          <span className="text-ink-500 text-sm">Fully booked</span>
        ) : (
          <Button
            disabled={!start}
            onClick={() => toast.info("Requesting a hoarding arrives in Phase 7.")}
          >
            {start ? ctaLabel : "Request"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-surface-2 text-ink-700 rounded-full px-2 py-0.5 text-[11px] font-medium">
      {children}
    </span>
  );
}
