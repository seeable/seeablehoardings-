"use client";

import Link from "next/link";
import { MapPin, ImageOff } from "lucide-react";
import { VerifiedBadge } from "@/components/ui/badge";
import { formatPrice, formatDate } from "@/lib/format";
import { todayIST } from "@/lib/date";
import type { DiscoverCard } from "@/lib/discovery/types";
import { cn } from "@/lib/utils";

/**
 * Hoarding Card — docs/02 §10.4. Used by VW-01 (grid) and VW-02 (map strip).
 * Availability is always text ("Available from 15 Sep"), never colour alone
 * (§24.1). The Publisher name is a label, never a link (disintermediation).
 */
export function HoardingCard({
  hoarding: h,
  href,
  compact,
  highlighted,
  onHover,
}: {
  hoarding: DiscoverCard;
  href: string;
  compact?: boolean;
  highlighted?: boolean;
  onHover?: (id: string | null) => void;
}) {
  const avail = availabilityLabel(h.availability_summary.next_available_date);

  return (
    <Link
      href={href}
      onMouseEnter={() => onHover?.(h.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "border-border bg-surface-1 group block overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md motion-reduce:transition-none",
        highlighted && "ring-gold-500 ring-2",
        compact && "w-64 shrink-0",
      )}
    >
      <div className="bg-surface-2 relative aspect-video w-full">
        {h.primary_media_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={h.primary_media_url}
            alt={`${h.title} photo`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="text-ink-300 flex h-full items-center justify-center">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="space-y-1.5 p-3">
        <p className="text-h4 text-ink-900 line-clamp-1">{h.title}</p>
        <p className="text-ink-700 flex items-center gap-1 text-[13px]">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-1">
            {[h.location.locality, h.location.city].filter(Boolean).join(", ")}
          </span>
          {h.distance_km != null && (
            <span className="text-ink-500 shrink-0">
              · {h.distance_km.toFixed(1)} km
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip>{h.type.display_name}</Chip>
          {h.size && <Chip>{h.size}</Chip>}
        </div>
        <div className="flex items-end justify-between gap-2 pt-0.5">
          <div>
            <p className="text-ink-900 text-sm font-semibold">
              {formatPrice(h.price, h.price_unit)}
            </p>
            <p className="text-ink-500 flex items-center gap-1 text-xs">
              {h.publisher.business_name ?? "SEEABLE Publisher"}
              {h.publisher.is_verified && <VerifiedBadge />}
            </p>
          </div>
          <p
            className={cn(
              "shrink-0 text-right text-xs",
              avail.tone === "good" ? "text-success-700" : "text-ink-500",
            )}
          >
            {avail.text}
          </p>
        </div>
      </div>
    </Link>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-surface-2 text-ink-700 rounded-full px-2 py-0.5 text-[11px] font-medium">
      {children}
    </span>
  );
}

function availabilityLabel(next: string | null): {
  text: string;
  tone: "good" | "muted";
} {
  if (!next) return { text: "Limited availability", tone: "muted" };
  if (next <= todayIST()) return { text: "Available now", tone: "good" };
  return { text: `Available from ${formatDate(next)}`, tone: "good" };
}
