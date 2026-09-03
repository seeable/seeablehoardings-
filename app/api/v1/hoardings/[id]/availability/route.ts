import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { requireRow } from "@/lib/api/authz";
import { pgErrorToApiError } from "@/lib/db/errors";
import { availabilityQuerySchema } from "@/lib/inventory/schema";
import { addDays, todayIST } from "@/lib/date";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOOKED_STATUSES = ["CONFIRMED", "LIVE", "COMPLETED"];

/**
 * GET /api/v1/hoardings/{id}/availability — api-specification.md §15.2.
 * `unavailable_ranges` composes Publisher blocks with confirmed-request dates
 * (the same three inputs `is_hoarding_available()` uses). Owner/Admin also get
 * `blocks` (with ids, for PB-05's unblock) and `bookings` (with the Viewer name
 * for the upcoming-bookings side list). A Viewer gets neither identity nor ids.
 */
export const GET = defineRoute<z.infer<typeof availabilityQuerySchema>, undefined, { id: string }>({
  path: "/api/v1/hoardings/{id}/availability",
  auth: true,
  query: availabilityQuerySchema,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, user, params, query, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);

    const from = query.from ?? todayIST();
    const to = query.to ?? addDays(from, 180);
    if (to < from) throw ApiError.of("INVALID_DATE_RANGE");
    if (addDays(from, 365) < to) throw ApiError.of("INVALID_DATE_RANGE");

    const { data: hoarding, error } = await supabase
      .from("hoardings")
      .select("id, publisher_id, approval_status, is_paused, is_delisted")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw pgErrorToApiError(error);
    const row = requireRow(hoarding, "HOARDING_NOT_FOUND");
    const privileged =
      row.publisher_id === user!.id || user!.role === "ADMIN";
    const isListed =
      row.approval_status === "APPROVED" && !row.is_paused && !row.is_delisted;

    const unavailable: {
      start_date: string;
      end_date: string;
      reason: "BOOKED" | "BLOCKED";
    }[] = [];
    let blocks: unknown[] = [];
    let bookings: unknown[] = [];

    if (privileged) {
      const [blockRes, reqRes] = await Promise.all([
        supabase
          .from("hoarding_availability_blocks")
          .select("id, start_date, end_date, reason")
          .eq("hoarding_id", params.id)
          .lte("start_date", to)
          .gte("end_date", from)
          .order("start_date", { ascending: true }),
        supabase
          .from("publisher_inbox")
          .select("id, start_date, end_date, status, viewer_name")
          .eq("hoarding_id", params.id)
          .in("status", BOOKED_STATUSES)
          .lte("start_date", to)
          .gte("end_date", from)
          .order("start_date", { ascending: true }),
      ]);
      if (blockRes.error) throw pgErrorToApiError(blockRes.error);
      if (reqRes.error) throw pgErrorToApiError(reqRes.error);

      blocks = blockRes.data ?? [];
      bookings = (reqRes.data ?? []).map((r) => ({
        start_date: String(r.start_date),
        end_date: String(r.end_date),
        status: r.status,
        viewer_name: r.viewer_name,
      }));
      for (const b of blockRes.data ?? [])
        unavailable.push({
          start_date: b.start_date,
          end_date: b.end_date,
          reason: "BLOCKED",
        });
      for (const r of reqRes.data ?? [])
        unavailable.push({
          start_date: String(r.start_date),
          end_date: String(r.end_date),
          reason: "BOOKED",
        });
    } else {
      const { data: detail, error: dErr } = await supabase
        .from("public_hoarding_detail")
        .select("booked_ranges, blocked_ranges")
        .eq("id", params.id)
        .maybeSingle();
      if (dErr) throw pgErrorToApiError(dErr);
      const d = requireRow(detail, "HOARDING_NOT_FOUND");
      for (const r of (d.booked_ranges ?? []) as {
        start_date: string;
        end_date: string;
      }[])
        unavailable.push({ ...r, reason: "BOOKED" });
      for (const r of (d.blocked_ranges ?? []) as {
        start_date: string;
        end_date: string;
      }[])
        unavailable.push({ ...r, reason: "BLOCKED" });
    }

    unavailable.sort((a, b) => a.start_date.localeCompare(b.start_date));

    return {
      data: {
        hoarding_id: params.id,
        window: { from, to },
        is_listed: isListed,
        unavailable_ranges: unavailable,
        ...(privileged ? { blocks, bookings } : {}),
      },
    };
  },
});
