"use client";

import { api } from "@/lib/api/client";
import type {
  DiscoverFilters,
  DiscoverResult,
  PublicHoardingDetail,
} from "@/lib/discovery/types";

const PAGE_SIZE = 24;

export function filtersToSearchParams(f: DiscoverFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.type) p.set("type", f.type);
  if (f.maxPrice != null) p.set("maxPrice", String(f.maxPrice));
  if (f.center && f.maxDistance != null) {
    p.set("latitude", String(f.center.latitude));
    p.set("longitude", String(f.center.longitude));
    p.set("maxDistance", String(f.maxDistance));
  }
  if (f.sort && f.sort !== "distance") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  return p;
}

export async function searchHoardings(
  f: DiscoverFilters,
): Promise<DiscoverResult> {
  const p = filtersToSearchParams(f);
  p.set("pageSize", String(PAGE_SIZE));
  const r = await api.get<{ hoardings: DiscoverResult["hoardings"] }>(
    `/api/v1/hoardings?${p}`,
  );
  return {
    hoardings: r.data.hoardings,
    pagination: (r.meta.pagination as DiscoverResult["pagination"]) ?? {
      page: 1,
      page_size: PAGE_SIZE,
      total: r.data.hoardings.length,
      total_pages: 1,
      has_next: false,
      has_previous: false,
    },
    filters_applied:
      (r.meta.filters_applied as Record<string, unknown>) ?? {},
  };
}

export async function getPublicHoarding(
  id: string,
  center?: { latitude: number; longitude: number },
): Promise<PublicHoardingDetail> {
  const qs = center
    ? `?latitude=${center.latitude}&longitude=${center.longitude}`
    : "";
  const r = await api.get<{ hoarding: PublicHoardingDetail }>(
    `/api/v1/hoardings/${id}${qs}`,
  );
  return r.data.hoarding;
}
