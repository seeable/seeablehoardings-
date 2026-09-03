/**
 * Viewer-facing hoarding shapes — api-specification.md §11.2.
 * The disintermediation boundary is the DB views (`public_hoarding_listings` /
 * `public_hoarding_detail`, `security_invoker = false`); this module only
 * reshapes their already-safe rows into the API contract. No `profiles` join,
 * no contact field, ever.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { PUBLIC_BUCKET } from "@/lib/inventory/media";
import type {
  DiscoverCard,
  PublicHoardingDetail,
} from "@/lib/discovery/types";

type Supa = SupabaseClient<Database>;

const publicUrl = (supabase: Supa, path: string) =>
  supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;

/** Partial-omission (api-spec §11.2 / VW-03): drop empty/null keys; a footfall
 *  of 0 and an unknown footfall must not look alike. Returns null when nothing
 *  is left, so the client omits the whole panel. */
export function pruneSiteIntelligence(
  si: Json | null | undefined,
): Record<string, unknown> | null {
  if (!si || typeof si !== "object" || Array.isArray(si)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(si)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

type SearchRow =
  Database["public"]["Functions"]["search_available_hoardings"]["Returns"][number];

export function toDiscoverCard(
  row: SearchRow,
  ctx: { typeName: Map<string, string>; primaryUrl: Map<string, string> },
): DiscoverCard {
  return {
    id: row.id,
    title: row.title,
    type: {
      code: row.type_code,
      display_name: ctx.typeName.get(row.type_code) ?? row.type_code,
    },
    size: row.size,
    price: row.price,
    price_unit: row.price_unit,
    currency: "INR",
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      locality: row.locality,
      city: row.city,
      address_text: row.address_text,
    },
    publisher: {
      business_name: row.publisher_business_name,
      is_verified: row.publisher_is_verified,
    },
    primary_media_url: ctx.primaryUrl.get(row.id) ?? null,
    availability_summary: {
      is_listed: true,
      next_available_date: row.next_available_date ?? null,
    },
    distance_km: row.distance_km ?? null,
    created_at: row.created_at,
  };
}

type DetailRow = Database["public"]["Views"]["public_hoarding_detail"]["Row"];

export function toPublicDetail(
  supabase: Supa,
  row: DetailRow,
  ctx: { typeName: Map<string, string>; distanceKm: number | null },
): PublicHoardingDetail {
  const media = (
    (row.media ?? []) as {
      id: string;
      media_type: string;
      storage_path: string;
      is_primary: boolean;
      display_order: number;
    }[]
  ).map((m) => ({
    id: m.id,
    media_type: m.media_type,
    url: publicUrl(supabase, m.storage_path),
    is_primary: m.is_primary,
    display_order: m.display_order,
  }));

  const booked = (row.booked_ranges ?? []) as { start_date: string; end_date: string }[];
  const blocked = (row.blocked_ranges ?? []) as { start_date: string; end_date: string }[];

  return {
    id: row.id!,
    title: row.title!,
    type: {
      code: row.type_code!,
      display_name: ctx.typeName.get(row.type_code!) ?? row.type_code!,
    },
    description: row.description ?? null,
    size: row.size,
    price: row.price,
    price_unit: row.price_unit!,
    currency: "INR",
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      locality: row.locality,
      city: row.city!,
      address_text: row.address_text,
    },
    publisher: {
      business_name: row.publisher_business_name,
      is_verified: !!row.publisher_is_verified,
    },
    primary_media_url:
      media.find((m) => m.is_primary)?.url ?? media[0]?.url ?? null,
    attributes: (row.attributes ?? {}) as Record<string, unknown>,
    site_intelligence: pruneSiteIntelligence(row.site_intelligence),
    site_intelligence_complete: !!row.site_intelligence_complete,
    media,
    booked_ranges: booked,
    blocked_ranges: blocked,
    availability_summary: {
      is_listed: true,
      next_available_date: nextAvailableDate(booked, blocked),
    },
    distance_km: ctx.distanceKm,
    created_at: row.created_at!,
  };
}

/** First date in the next 180 days covered by neither a block nor a
 *  confirmed booking. Mirrors the SQL in `search_available_hoardings`. */
export function nextAvailableDate(
  booked: { start_date: string; end_date: string }[],
  blocked: { start_date: string; end_date: string }[],
  today = new Date(),
): string | null {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(today);
  const ranges = [...booked, ...blocked];
  for (let i = 0; i <= 180; i++) {
    const d = addDays(iso, i);
    if (!ranges.some((r) => d >= r.start_date && d <= r.end_date)) return d;
  }
  return null;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

/** Haversine, km — for `distance_km` on the detail endpoint (§11.4). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}
