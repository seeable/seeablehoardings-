import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";
import { myRequestsQuerySchema } from "@/lib/requests/schema";
import { toRequestResource, typeNameMap } from "@/lib/requests/projection";
import type { RequestStatus } from "@/lib/requests/types";
import { todayIST } from "@/lib/date";

export const dynamic = "force-dynamic";

const STATUSES: RequestStatus[] = [
  "REQUESTED",
  "CONFIRMED",
  "REJECTED",
  "EXPIRED",
  "LIVE",
  "COMPLETED",
];

/**
 * GET /api/v1/requests/me — api-specification.md §23.2. The Viewer's own
 * requests, newest first, `status_label` in Viewer vocabulary,
 * `available_actions` always `[]`. `viewer_request_list` is scoped by
 * `auth.uid()`, so the embedded hoarding summary survives a since-paused listing.
 */
export const GET = defineRoute<z.infer<typeof myRequestsQuerySchema>>({
  path: "/api/v1/requests/me",
  auth: "VIEWER",
  query: myRequestsQuerySchema,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, searchParams }) => {
    const { page, pageSize, from, to } = parsePagination(searchParams);

    const filter = searchParams.getAll("status");
    for (const s of filter) {
      if (!STATUSES.includes(s as RequestStatus)) {
        throw ApiError.of("INVALID_FILTER");
      }
    }

    let q = supabase.from("viewer_request_list").select("*", { count: "exact" });
    if (filter.length) q = q.in("status", filter);

    const [listRes, countRes, typeName] = await Promise.all([
      q.order("created_at", { ascending: false }).range(from, to),
      supabase.from("viewer_request_list").select("status"),
      typeNameMap(supabase),
    ]);
    if (listRes.error) throw pgErrorToApiError(listRes.error);

    const now = new Date();
    const today = todayIST(now);
    const requests = (listRes.data ?? []).map((r) =>
      toRequestResource(supabase, r, { role: "VIEWER", typeName, today, now }),
    );

    const counts_by_status = Object.fromEntries(
      STATUSES.map((s) => [
        s,
        (countRes.data ?? []).filter((r) => r.status === s).length,
      ]),
    );

    return {
      data: { requests },
      meta: {
        pagination: paginationMeta(listRes.count ?? 0, { page, pageSize }),
        counts_by_status,
      },
    };
  },
});
