import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError } from "@/lib/db/errors";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";
import { inboxQuerySchema } from "@/lib/requests/schema";
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
 * GET /api/v1/publishers/me/requests — api-specification.md §22.4. The request
 * inbox: `REQUESTED` first, then `sla_deadline ASC NULLS LAST`, then
 * `created_at DESC` — so the items nearest their SLA deadline surface first
 * (OWNER-002). `publisher_inbox` is scoped by `auth.uid()`.
 *
 * The sort key is a CASE expression PostgREST cannot express in `.order()`, and
 * at MVP scale (mvp-prd §10 — a handful of requests per Publisher) fetching the
 * inbox and sorting/paginating in memory is correct and simplest.
 */
export const GET = defineRoute<z.infer<typeof inboxQuerySchema>>({
  path: "/api/v1/publishers/me/requests",
  auth: "PUBLISHER",
  query: inboxQuerySchema,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, searchParams }) => {
    const { page, pageSize, from, to } = parsePagination(searchParams);

    const statusFilter = searchParams.getAll("status");
    for (const s of statusFilter) {
      if (!STATUSES.includes(s as RequestStatus)) {
        throw ApiError.of("INVALID_FILTER");
      }
    }
    const hoardingId = searchParams.get("hoarding_id");
    if (hoardingId && !inboxQuerySchema.shape.hoarding_id.safeParse(hoardingId).success) {
      throw ApiError.of("INVALID_FILTER");
    }

    let q = supabase.from("publisher_inbox").select("*");
    if (hoardingId) q = q.eq("hoarding_id", hoardingId);

    const [{ data: rows, error }, typeName] = await Promise.all([
      q,
      typeNameMap(supabase),
    ]);
    if (error) throw pgErrorToApiError(error);

    const now = new Date();
    const today = todayIST(now);

    const counts_by_status = Object.fromEntries(
      STATUSES.map((s) => [
        s,
        (rows ?? []).filter((r) => r.status === s).length,
      ]),
    );

    const filtered = (rows ?? []).filter(
      (r) => statusFilter.length === 0 || statusFilter.includes(r.status ?? ""),
    );
    filtered.sort((a, b) => {
      const aReq = a.status === "REQUESTED" ? 0 : 1;
      const bReq = b.status === "REQUESTED" ? 0 : 1;
      if (aReq !== bReq) return aReq - bReq;
      if (a.sla_deadline !== b.sla_deadline) {
        if (!a.sla_deadline) return 1; // NULLS LAST
        if (!b.sla_deadline) return -1;
        return a.sla_deadline < b.sla_deadline ? -1 : 1;
      }
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });

    const requests = filtered
      .slice(from, to + 1)
      .map((r) =>
        toRequestResource(supabase, r, {
          role: "PUBLISHER",
          typeName,
          today,
          now,
        }),
      );

    return {
      data: { requests },
      meta: {
        pagination: paginationMeta(filtered.length, { page, pageSize }),
        counts_by_status,
      },
    };
  },
});
