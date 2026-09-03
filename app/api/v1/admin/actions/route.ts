import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";
import { pgErrorToApiError } from "@/lib/db/errors";
import { adminActionsQuerySchema } from "@/lib/admin/schema";
import { toAdminActionRow } from "@/lib/admin/projection";

export const dynamic = "force-dynamic";

const ACTION_TYPES = new Set([
  "LISTING_APPROVED",
  "LISTING_REJECTED",
  "PUBLISHER_VERIFIED",
  "PUBLISHER_VERIFICATION_REJECTED",
  "PUBLISHER_SUSPENDED",
  "PUBLISHER_UNSUSPENDED",
  "HOARDING_DELISTED",
  "HOARDING_RELISTED",
]);

/**
 * GET /api/v1/admin/actions — api-specification.md §24.7, AD-05.
 * The lightweight moderation feed — NOT the full-scope audit log. `admin_actions`
 * has an Admin-only read policy. `action_type` is repeatable; newest first.
 * `admin_label` is a denormalised snapshot, so a row stays readable after the
 * acting Admin's account is gone.
 */
export const GET = defineRoute<z.infer<typeof adminActionsQuerySchema>>({
  path: "/api/v1/admin/actions",
  auth: "ADMIN",
  query: adminActionsQuerySchema,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, searchParams }) => {
    const { page, pageSize, from, to } = parsePagination(searchParams);
    const types = searchParams
      .getAll("action_type")
      .filter((t) => ACTION_TYPES.has(t));
    const hoardingId = searchParams.get("target_hoarding_id");
    const publisherId = searchParams.get("target_publisher_id");

    let q = supabase.from("admin_actions").select("*", { count: "exact" });
    if (types.length > 0) q = q.in("action_type", types);
    if (hoardingId) q = q.eq("target_hoarding_id", hoardingId);
    if (publisherId) q = q.eq("target_publisher_id", publisherId);

    const { data: rows, count, error } = await q
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw pgErrorToApiError(error);

    const list = rows ?? [];
    const hoardingIds = [
      ...new Set(list.map((r) => r.target_hoarding_id).filter((x): x is string => !!x)),
    ];
    const publisherIds = [
      ...new Set(list.map((r) => r.target_publisher_id).filter((x): x is string => !!x)),
    ];

    const [{ data: hoardings }, { data: pubProfiles }, { data: profiles }] =
      await Promise.all([
        hoardingIds.length
          ? supabase.from("hoardings").select("id, title").in("id", hoardingIds)
          : Promise.resolve({ data: [] as never[] }),
        publisherIds.length
          ? supabase
              .from("publisher_profiles")
              .select("id, business_name")
              .in("id", publisherIds)
          : Promise.resolve({ data: [] as never[] }),
        publisherIds.length
          ? supabase.from("profiles").select("id, full_name").in("id", publisherIds)
          : Promise.resolve({ data: [] as never[] }),
      ]);

    const title = new Map((hoardings ?? []).map((h) => [h.id, h.title]));
    const bizName = new Map(
      (pubProfiles ?? []).map((p) => [p.id, p.business_name]),
    );
    const fullName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const actions = list.map((a) =>
      toAdminActionRow(a, {
        hoardingTitle: a.target_hoarding_id
          ? (title.get(a.target_hoarding_id) ?? null)
          : null,
        publisherLabel: a.target_publisher_id
          ? (bizName.get(a.target_publisher_id) ??
            fullName.get(a.target_publisher_id) ??
            null)
          : null,
      }),
    );

    return {
      data: { actions },
      meta: { pagination: paginationMeta(count ?? 0, { page, pageSize }) },
    };
  },
});
