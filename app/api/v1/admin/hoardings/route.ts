import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";
import { pgErrorToApiError } from "@/lib/db/errors";
import { adminListingQuerySchema } from "@/lib/admin/schema";
import { toAdminListingRow } from "@/lib/admin/projection";

export const dynamic = "force-dynamic";

const APPROVAL_STATES = new Set([
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
]);

/**
 * GET /api/v1/admin/hoardings — api-specification.md §24.5, AD-02 Listings +
 * AD-04. The approval queue and the full inventory table share this endpoint;
 * `approval_status` is repeatable (default `PENDING_REVIEW` — it is a queue),
 * `delisted=true` selects delisted listings across every approval state.
 * Oldest-waiting first. Admin RLS (`is_admin()` branch) exposes every row.
 */
export const GET = defineRoute<z.infer<typeof adminListingQuerySchema>>({
  path: "/api/v1/admin/hoardings",
  auth: "ADMIN",
  query: adminListingQuerySchema,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, searchParams }) => {
    const { page, pageSize, from, to } = parsePagination(searchParams);

    const statuses = searchParams
      .getAll("approval_status")
      .filter((s) => APPROVAL_STATES.has(s));
    const delisted = searchParams.get("delisted");
    const publisherId = searchParams.get("publisher_id");
    const type = searchParams.get("type");
    const siComplete = searchParams.get("site_intelligence_complete");

    let q = supabase.from("hoardings").select("*", { count: "exact" });

    if (delisted === "true") q = q.eq("is_delisted", true);
    else if (delisted === "false") q = q.eq("is_delisted", false);

    if (statuses.length > 0) q = q.in("approval_status", statuses);
    else if (delisted === null) q = q.eq("approval_status", "PENDING_REVIEW");

    if (publisherId) q = q.eq("publisher_id", publisherId);
    if (type) q = q.eq("type_code", type);
    if (siComplete === "true") q = q.eq("site_intelligence_complete", true);
    if (siComplete === "false") q = q.eq("site_intelligence_complete", false);

    const { data: rows, count, error } = await q
      .order("created_at", { ascending: true })
      .range(from, to);
    if (error) throw pgErrorToApiError(error);

    const list = rows ?? [];
    const ids = list.map((r) => r.id);
    const pubIds = [...new Set(list.map((r) => r.publisher_id))];

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
            .select("id, business_name, verification_status, suspended")
            .in("id", pubIds)
        : Promise.resolve({ data: [] as never[] }),
      supabase.from("hoarding_types").select("code, display_name"),
    ]);

    const pubById = new Map(
      (pubs ?? []).map((p) => [
        p.id,
        {
          id: p.id,
          business_name: p.business_name,
          verification_status: p.verification_status,
          suspended: p.suspended,
        },
      ]),
    );
    const typeName = new Map((types ?? []).map((t) => [t.code, t.display_name]));
    const mediaList = media ?? [];

    const hoardings = list.map((h) =>
      toAdminListingRow(supabase, h, {
        typeName: typeName.get(h.type_code) ?? h.type_code,
        publisher: pubById.get(h.publisher_id) ?? null,
        media: mediaList,
      }),
    );

    return {
      data: { hoardings },
      meta: { pagination: paginationMeta(count ?? 0, { page, pageSize }) },
    };
  },
});
