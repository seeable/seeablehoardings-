import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";
import { pgErrorToApiError } from "@/lib/db/errors";
import { mediaUrl } from "@/lib/inventory/projection";
import { effectiveStatus, type HoardingListItem } from "@/lib/inventory/types";
import { myHoardingsQuerySchema } from "@/lib/inventory/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/publishers/me/hoardings — api-specification.md §9 (PB-02).
 * The Publisher's own listings in every state, newest-updated first. RLS scopes
 * rows via the `publisher_id = auth.uid()` branch of
 * `hoardings_select_visible_or_own_or_admin`.
 */
export const GET = defineRoute<z.infer<typeof myHoardingsQuerySchema>>({
  path: "/api/v1/publishers/me/hoardings",
  auth: "PUBLISHER",
  query: myHoardingsQuerySchema,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, user, query, searchParams }) => {
    const { page, pageSize, from, to } = parsePagination(searchParams);

    let q = supabase
      .from("hoardings")
      .select("*", { count: "exact" })
      .eq("publisher_id", user!.id);

    switch (query.status) {
      case "DRAFT":
      case "PENDING_REVIEW":
      case "REJECTED":
        q = q.eq("approval_status", query.status);
        break;
      case "APPROVED":
        q = q
          .eq("approval_status", "APPROVED")
          .eq("is_paused", false)
          .eq("is_delisted", false);
        break;
      case "PAUSED":
        q = q.eq("is_paused", true).eq("is_delisted", false);
        break;
      case "DELISTED":
        q = q.eq("is_delisted", true);
        break;
    }

    const { data: rows, count, error } = await q
      .order("updated_at", { ascending: false })
      .range(from, to);
    if (error) throw pgErrorToApiError(error);

    const ids = (rows ?? []).map((r) => r.id);
    const [{ data: media }, { data: pending }, { data: types }] =
      await Promise.all([
        ids.length
          ? supabase
              .from("hoarding_media")
              .select("hoarding_id, storage_path, processing_status")
              .in("hoarding_id", ids)
              .eq("is_primary", true)
          : Promise.resolve({ data: [] as never[] }),
        supabase
          .from("requests")
          .select("hoarding_id")
          .eq("publisher_id", user!.id)
          .eq("status", "REQUESTED"),
        supabase.from("hoarding_types").select("code, display_name"),
      ]);

    const primaryUrl = new Map<string, string>();
    for (const m of media ?? []) {
      if (m.processing_status === "WATERMARKED")
        primaryUrl.set(m.hoarding_id, mediaUrl(supabase, m.storage_path));
    }
    const pendingCount = new Map<string, number>();
    for (const r of pending ?? [])
      pendingCount.set(r.hoarding_id, (pendingCount.get(r.hoarding_id) ?? 0) + 1);
    const typeName = new Map((types ?? []).map((t) => [t.code, t.display_name]));

    const hoardings: HoardingListItem[] = (rows ?? []).map((h) => {
      const pc = pendingCount.get(h.id) ?? 0;
      return {
        id: h.id,
        title: h.title,
        type_code: h.type_code,
        type_display_name: typeName.get(h.type_code) ?? h.type_code,
        approval_status: h.approval_status,
        is_paused: h.is_paused,
        is_delisted: h.is_delisted,
        effective_status: effectiveStatus(h),
        price: h.price,
        price_unit: h.price_unit,
        primary_media_url: primaryUrl.get(h.id) ?? null,
        pending_request_count: pc,
        is_edit_frozen: pc > 0,
        rejection_reason: h.rejection_reason,
        updated_at: h.updated_at,
      };
    });

    return {
      data: { hoardings },
      meta: { pagination: paginationMeta(count ?? 0, { page, pageSize }) },
    };
  },
});
