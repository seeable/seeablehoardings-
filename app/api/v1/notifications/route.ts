import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";
import { pgErrorToApiError } from "@/lib/db/errors";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    page: z.string().optional(),
    pageSize: z.string().optional(),
    unread: z.enum(["true", "false"]).optional(),
  })
  .strict(); // an unknown param -> 400 INVALID_FILTER (§10.2)

/**
 * GET /api/v1/notifications — api-specification.md §9.4 (paginated, created_at DESC).
 * RLS (`notifications_select_own`) scopes rows to the recipient; the facade
 * never uses the service role.
 */
export const GET = defineRoute<z.infer<typeof querySchema>>({
  path: "/api/v1/notifications",
  auth: true,
  query: querySchema,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, searchParams, query }) => {
    const { page, pageSize, from, to } = parsePagination(searchParams);

    let q = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (query.unread === "true") q = q.eq("is_read", false);

    const { data, count, error } = await q;
    if (error) throw pgErrorToApiError(error);

    return {
      data: { notifications: data ?? [] },
      meta: { pagination: paginationMeta(count ?? 0, { page, pageSize }) },
    };
  },
});
