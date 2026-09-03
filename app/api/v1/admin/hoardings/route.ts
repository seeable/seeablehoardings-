import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";
import { pgErrorToApiError } from "@/lib/db/errors";
import { mediaUrl } from "@/lib/inventory/projection";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({ page: z.string().optional(), pageSize: z.string().optional() })
  .strict();

/**
 * GET /api/v1/admin/hoardings — api-specification.md §9 (AD-04, minimal).
 * The approval queue: PENDING_REVIEW listings, oldest-waiting first. Admin RLS
 * (`is_admin()` branch) exposes every row. Full AD-02 is Phase 9.
 */
export const GET = defineRoute<z.infer<typeof querySchema>>({
  path: "/api/v1/admin/hoardings",
  auth: "ADMIN",
  query: querySchema,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, searchParams }) => {
    const { page, pageSize, from, to } = parsePagination(searchParams);

    const { data: rows, count, error } = await supabase
      .from("hoardings")
      .select("*", { count: "exact" })
      .eq("approval_status", "PENDING_REVIEW")
      .order("created_at", { ascending: true })
      .range(from, to);
    if (error) throw pgErrorToApiError(error);

    const ids = (rows ?? []).map((r) => r.id);
    const pubIds = [...new Set((rows ?? []).map((r) => r.publisher_id))];
    const [{ data: media }, { data: pubs }, { data: types }] = await Promise.all([
      ids.length
        ? supabase
            .from("hoarding_media")
            .select("hoarding_id, storage_path, processing_status, is_primary")
            .in("hoarding_id", ids)
        : Promise.resolve({ data: [] as never[] }),
      pubIds.length
        ? supabase
            .from("publisher_profiles")
            .select("id, business_name, verification_status")
            .in("id", pubIds)
        : Promise.resolve({ data: [] as never[] }),
      supabase.from("hoarding_types").select("code, display_name"),
    ]);

    const primary = new Map<string, string>();
    const mediaCount = new Map<string, number>();
    for (const m of media ?? []) {
      mediaCount.set(m.hoarding_id, (mediaCount.get(m.hoarding_id) ?? 0) + 1);
      if (m.is_primary && m.processing_status === "WATERMARKED")
        primary.set(m.hoarding_id, mediaUrl(supabase, m.storage_path));
    }
    const pub = new Map((pubs ?? []).map((p) => [p.id, p]));
    const typeName = new Map((types ?? []).map((t) => [t.code, t.display_name]));

    const hoardings = (rows ?? []).map((h) => ({
      id: h.id,
      title: h.title,
      type_code: h.type_code,
      type_display_name: typeName.get(h.type_code) ?? h.type_code,
      price: h.price,
      price_unit: h.price_unit,
      locality: h.locality,
      city: h.city,
      latitude: h.latitude,
      longitude: h.longitude,
      description: h.description,
      size: h.size,
      attributes: h.attributes,
      site_intelligence: h.site_intelligence,
      site_intelligence_complete: h.site_intelligence_complete,
      created_at: h.created_at,
      publisher_business_name: pub.get(h.publisher_id)?.business_name ?? null,
      publisher_is_verified:
        pub.get(h.publisher_id)?.verification_status === "VERIFIED",
      primary_media_url: primary.get(h.id) ?? null,
      media_count: mediaCount.get(h.id) ?? 0,
    }));

    return {
      data: { hoardings },
      meta: { pagination: paginationMeta(count ?? 0, { page, pageSize }) },
    };
  },
});
