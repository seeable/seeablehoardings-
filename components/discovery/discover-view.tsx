"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { List, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/discovery/filter-bar";
import { HoardingCard } from "@/components/discovery/hoarding-card";
import { searchHoardings, filtersToSearchParams } from "@/lib/discovery/client";
import { emitAnalyticsEvent } from "@/lib/analytics/client";
import { ApiClientError } from "@/lib/api/client";
import type { HoardingTypeView } from "@/lib/inventory/types";
import type {
  DiscoverCard,
  DiscoverFilters,
  DiscoverSort,
} from "@/lib/discovery/types";

const HoardingMap = dynamic(
  () => import("@/components/discovery/hoarding-map").then((m) => m.HoardingMap),
  { ssr: false, loading: () => <Skeleton className="h-full min-h-[24rem] w-full" /> },
);

function readFilters(sp: URLSearchParams): DiscoverFilters {
  const lat = sp.get("latitude");
  const lng = sp.get("longitude");
  return {
    type: sp.get("type") ?? undefined,
    maxPrice: sp.get("maxPrice") ? Number(sp.get("maxPrice")) : undefined,
    center:
      lat && lng
        ? { latitude: Number(lat), longitude: Number(lng) }
        : undefined,
    maxDistance: sp.get("maxDistance") ? Number(sp.get("maxDistance")) : undefined,
    sort: (sp.get("sort") as DiscoverSort) ?? "newest",
    page: 1,
  };
}

export function DiscoverView({ types }: { types: HoardingTypeView[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const filters = React.useMemo(() => readFilters(sp), [sp]);
  const mapView = sp.get("view") === "map";

  const [rows, setRows] = React.useState<DiscoverCard[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [hasNext, setHasNext] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);

  const key = filtersToSearchParams(filters).toString();
  const runKey = `${key}#${nonce}`;
  const [prevRunKey, setPrevRunKey] = React.useState(runKey);
  if (prevRunKey !== runKey) {
    setPrevRunKey(runKey);
    setRows(null);
    setPage(1);
    setSelectedId(null);
  }

  React.useEffect(() => {
    let cancelled = false;
    void emitAnalyticsEvent("SEARCH", {
      type: filters.type ?? null,
      max_price: filters.maxPrice ?? null,
      has_location: !!filters.center,
      sort: filters.sort,
    });
    searchHoardings({ ...filters, page: 1 })
      .then((r) => {
        if (cancelled) return;
        setRows(r.hoardings);
        setTotal(r.pagination.total);
        setHasNext(r.pagination.has_next);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof ApiClientError ? e.message : "Couldn't load hoardings.",
          );
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  function applyFilters(next: DiscoverFilters) {
    void emitAnalyticsEvent("FILTER_USED", {
      type: next.type ?? null,
      max_price: next.maxPrice ?? null,
      has_location: !!next.center,
      max_distance: next.maxDistance ?? null,
      sort: next.sort,
    });
    const params = filtersToSearchParams(next);
    if (mapView) params.set("view", "map");
    router.replace(params.toString() ? `/discover?${params}` : "/discover");
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const r = await searchHoardings({ ...filters, page: page + 1 });
      setRows((cur) => [...(cur ?? []), ...r.hoardings]);
      setPage((p) => p + 1);
      setHasNext(r.pagination.has_next);
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }

  const setView = (map: boolean) => {
    const params = filtersToSearchParams(filters);
    if (map) params.set("view", "map");
    router.replace(params.toString() ? `/discover?${params}` : "/discover");
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-h1 text-ink-900">Discover</h1>
        <div className="border-border flex rounded-md border p-0.5 lg:hidden">
          <ToggleBtn active={!mapView} onClick={() => setView(false)}>
            <List className="h-4 w-4" /> List
          </ToggleBtn>
          <ToggleBtn active={mapView} onClick={() => setView(true)}>
            <MapIcon className="h-4 w-4" /> Map
          </ToggleBtn>
        </div>
      </div>

      <FilterBar
        types={types}
        filters={filters}
        onChange={applyFilters}
        resultCount={rows === null ? null : total}
      />

      {error ? (
        <div className="mt-6">
          <Alert tone="danger">{error}</Alert>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setNonce((n) => n + 1)}
          >
            Retry
          </Button>
        </div>
      ) : mapView ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="order-2 max-h-[70dvh] space-y-3 overflow-y-auto lg:order-1">
            {(rows ?? []).map((h) => (
              <HoardingCard
                key={h.id}
                hoarding={h}
                href={`/discover/${h.id}`}
                highlighted={selectedId === h.id}
                onHover={setSelectedId}
              />
            ))}
            {rows?.length === 0 && (
              <p className="text-ink-500 text-sm">No hoardings in this filter.</p>
            )}
          </div>
          <div className="order-1 h-[50dvh] lg:order-2 lg:h-[70dvh]">
            <HoardingMap
              hoardings={rows ?? []}
              selectedId={selectedId}
              onSelect={setSelectedId}
              center={filters.center ?? null}
            />
          </div>
        </div>
      ) : rows === null ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            tone={key ? "filtered" : "neutral"}
            headline={
              key ? "No hoardings match these filters" : "No hoardings yet"
            }
            body={
              key
                ? "Try widening your budget or distance."
                : "New hoardings appear here as Publishers list them — check back soon."
            }
            action={
              key ? (
                <Button variant="secondary" onClick={() => router.replace("/discover")}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((h) => (
              <li key={h.id}>
                <HoardingCard hoarding={h} href={`/discover/${h.id}`} />
              </li>
            ))}
          </ul>
          {hasNext && (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium " +
        (active ? "bg-ink-900 text-surface-1" : "text-ink-700")
      }
    >
      {children}
    </button>
  );
}
