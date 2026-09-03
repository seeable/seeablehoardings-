import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";
import {
  asJson,
  createHoardingSchema,
  discoverQuerySchema,
} from "@/lib/inventory/schema";
import { buildOwnerView } from "@/lib/inventory/projection";
import { mediaUrl } from "@/lib/inventory/projection";
import { toDiscoverCard } from "@/lib/inventory/public-view";

export const dynamic = "force-dynamic";

const numParam = (raw: string | undefined, code: string): number | null => {
  if (raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw ApiError.of("VALIDATION_ERROR", undefined, { param: code });
  return n;
};

/**
 * GET /api/v1/hoardings — api-specification.md §10. The one query surface for
 * the whole Viewer experience (list + map, one filtered result set). Thin over
 * `search_available_hoardings()` — INVENTORY-003 lives in `visible_hoardings`,
 * never re-implemented here (§10.6). Digital types can't be APPROVED, so they
 * never appear.
 */
export const GET = defineRoute<z.infer<typeof discoverQuerySchema>>({
  path: "/api/v1/hoardings",
  auth: true,
  query: discoverQuerySchema,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, searchParams, query }) => {
    if (searchParams.getAll("type").length > 1) {
      throw ApiError.of("INVALID_FILTER", "Only one `type` value is supported.");
    }

    const lat = numParam(query.latitude, "latitude");
    const lng = numParam(query.longitude, "longitude");
    const radius = numParam(query.maxDistance, "maxDistance");
    const geoParts = [lat, lng, radius].filter((x) => x !== null).length;
    if (geoParts !== 0 && geoParts !== 3) {
      throw ApiError.of("GEO_PARAMS_INCOMPLETE");
    }
    const maxPrice = numParam(query.maxPrice, "maxPrice");

    const { page, pageSize, from } = parsePagination(searchParams);

    const { data: rows, error } = await supabase.rpc(
      "search_available_hoardings",
      {
        p_type_code: query.type ?? undefined,
        p_city: query.city ?? undefined,
        p_center_lat: lat ?? undefined,
        p_center_lng: lng ?? undefined,
        p_radius_km: radius ?? undefined,
        p_max_price_monthly: maxPrice ?? undefined,
        p_sort: query.sort ?? undefined,
        p_limit: pageSize,
        p_offset: from,
      },
    );
    if (error) throw pgErrorToApiError(error);

    const list = rows ?? [];
    const total = Number(list[0]?.total_count ?? 0);
    const ids = list.map((r) => r.id);

    const [{ data: media }, { data: types }] = await Promise.all([
      ids.length
        ? supabase
            .from("hoarding_media")
            .select("hoarding_id, storage_path, processing_status")
            .in("hoarding_id", ids)
            .eq("is_primary", true)
        : Promise.resolve({ data: [] as never[] }),
      supabase.from("hoarding_types").select("code, display_name"),
    ]);

    const primaryUrl = new Map<string, string>();
    for (const m of media ?? [])
      if (m.processing_status === "WATERMARKED")
        primaryUrl.set(m.hoarding_id, mediaUrl(supabase, m.storage_path));
    const typeName = new Map((types ?? []).map((t) => [t.code, t.display_name]));

    return {
      data: {
        hoardings: list.map((r) => toDiscoverCard(r, { typeName, primaryUrl })),
      },
      meta: {
        pagination: paginationMeta(total, { page, pageSize }),
        filters_applied: {
          type: query.type ?? null,
          city: query.city ?? "Bengaluru",
          max_price_monthly: maxPrice,
          center: lat !== null ? { latitude: lat, longitude: lng } : null,
          radius_km: radius,
          sort: query.sort ?? (lat !== null ? "distance" : "newest"),
        },
      },
    };
  },
});

/**
 * POST /api/v1/hoardings — api-specification.md §12. Creates a DRAFT. Only
 * `type_code` + `title` are required; the rest fills in over the wizard and is
 * gated at `/submit`. `publisher_id` is `auth.uid()`, never the body
 * (`hoardings_insert_own` RLS + the column grant enforce it).
 */
export const POST = defineRoute<undefined, z.infer<typeof createHoardingSchema>>({
  path: "/api/v1/hoardings",
  auth: "PUBLISHER",
  body: createHoardingSchema,
  rateLimit: { perMinute: 30 },
  status: 201,
  handler: async ({ supabase, user, body, logResource }) => {
    const { data: type, error: typeErr } = await supabase
      .from("hoarding_types")
      .select("code, is_digital")
      .eq("code", body.type_code)
      .maybeSingle();
    if (typeErr) throw pgErrorToApiError(typeErr);
    if (!type) throw ApiError.of("HOARDING_TYPE_UNKNOWN");
    if (type.is_digital) throw ApiError.of("HOARDING_TYPE_NOT_LISTABLE");

    const { data, error } = await supabase
      .from("hoardings")
      .insert({
        publisher_id: user!.id,
        type_code: body.type_code,
        title: body.title,
        description: body.description ?? null,
        size: body.size ?? null,
        price: body.price ?? null,
        price_unit: body.price_unit ?? "MONTH",
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        locality: body.locality ?? null,
        city: body.city ?? "Bengaluru",
        address_text: body.address_text ?? null,
        attributes: asJson(body.attributes),
        site_intelligence: asJson(body.site_intelligence),
      })
      .select("*")
      .single();
    if (error) throw pgErrorToApiError(error);

    logResource(data.id);
    return { data: { hoarding: await buildOwnerView(supabase, data) } };
  },
});
