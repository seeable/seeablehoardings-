"use client";

import * as React from "react";
import { LocateFixed, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { HoardingTypeView } from "@/lib/inventory/types";
import type { DiscoverFilters, DiscoverSort } from "@/lib/discovery/types";
import { cn } from "@/lib/utils";

const RADII = [2, 5, 10, 25];

/**
 * VW-01 / VW-02 filters — the three MVP filters (type, budget, distance) + a
 * sort control. Digital types are disabled chips (docs/03 VW-01). Filters
 * combine with AND; the same bar drives the list and the map.
 */
export function FilterBar({
  types,
  filters,
  onChange,
  resultCount,
}: {
  types: HoardingTypeView[];
  filters: DiscoverFilters;
  onChange: (next: DiscoverFilters) => void;
  resultCount: number | null;
}) {
  const toast = useToast();
  const [locating, setLocating] = React.useState(false);
  const patch = (p: Partial<DiscoverFilters>) =>
    onChange({ ...filters, ...p, page: 1 });

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        patch({
          center: {
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
          },
          maxDistance: filters.maxDistance ?? 10,
        });
      },
      () => {
        setLocating(false);
        toast.error("Enable location access to filter by distance.");
      },
      { timeout: 8000 },
    );
  }

  const hasFilters =
    !!filters.type || filters.maxPrice != null || !!filters.center;

  return (
    <div className="space-y-3">
      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Chip
          active={!filters.type}
          onClick={() => patch({ type: undefined })}
        >
          All types
        </Chip>
        {types.map((t) => (
          <Chip
            key={t.code}
            active={filters.type === t.code}
            disabled={!t.is_listable}
            title={
              t.is_listable ? undefined : "Digital listings are coming soon"
            }
            onClick={() => patch({ type: t.code })}
          >
            {t.display_name}
            {!t.is_listable && " · soon"}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-ink-500 text-xs">Max ₹/month</span>
          <Input
            type="number"
            inputMode="numeric"
            className="h-9 w-28"
            placeholder="Any"
            value={filters.maxPrice ?? ""}
            onChange={(e) =>
              patch({
                maxPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </label>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={useMyLocation}
            aria-pressed={!!filters.center}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs",
              filters.center
                ? "border-gold-500 bg-gold-100/40 text-ink-900"
                : "border-border text-ink-700 hover:bg-surface-2",
            )}
          >
            <LocateFixed className="h-3.5 w-3.5" />
            {locating ? "Locating…" : filters.center ? "Near me" : "Use my location"}
          </button>
          <Select
            className="h-9 w-24"
            disabled={!filters.center}
            value={filters.maxDistance ?? ""}
            placeholder="Radius"
            onChange={(e) =>
              patch({ maxDistance: e.target.value ? Number(e.target.value) : undefined })
            }
          >
            {RADII.map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </Select>
        </div>

        <Select
          className="h-9 w-40"
          value={filters.center ? "distance" : (filters.sort ?? "newest")}
          disabled={!!filters.center}
          onChange={(e) => patch({ sort: e.target.value as DiscoverSort })}
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          {filters.center && <option value="distance">Nearest</option>}
        </Select>

        {hasFilters && (
          <button
            type="button"
            onClick={() =>
              onChange({ sort: filters.sort ?? "newest", page: 1 })
            }
            className="text-ink-500 hover:text-ink-900 flex items-center gap-1 text-xs"
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}

        {resultCount != null && (
          <span className="text-ink-500 ml-auto text-xs">
            {resultCount} hoarding{resultCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium whitespace-nowrap",
        active
          ? "border-ink-900 bg-ink-900 text-surface-1"
          : "border-border text-ink-700 hover:bg-surface-2",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
    >
      {children}
    </button>
  );
}
