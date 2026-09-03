import { z } from "zod";
import { defineRoute } from "@/lib/api/facade";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";
import { pgErrorToApiError } from "@/lib/db/errors";
import { adminPublisherQuerySchema } from "@/lib/admin/schema";
import {
  emptyListingCounts,
  tallyListingCounts,
  toAdminPublisherRow,
} from "@/lib/admin/projection";

export const dynamic = "force-dynamic";

const VERIFICATION_STATES = new Set([
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
]);

/**
 * GET /api/v1/admin/publishers — api-specification.md §26.2, AD-02 Publishers.
 * The verification queue and the full Publisher table share this endpoint.
 * `verification_status` is repeatable; longest-waiting first. Admin sees the
 * Publisher's `phone`/`email` here (and only here) — a verification decision
 * about an account is impossible without seeing the account (§26.2).
 */
export const GET = defineRoute<z.infer<typeof adminPublisherQuerySchema>>({
  path: "/api/v1/admin/publishers",
  auth: "ADMIN",
  query: adminPublisherQuerySchema,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, searchParams }) => {
    const { page, pageSize, from, to } = parsePagination(searchParams);
    const statuses = searchParams
      .getAll("verification_status")
      .filter((s) => VERIFICATION_STATES.has(s));
    const suspended = searchParams.get("suspended");

    let q = supabase
      .from("publisher_profiles")
      .select(
        "id, business_name, business_type, verification_status, verified_at, verification_submitted_at, verification_rejection_reason, verification_document_path, suspended, suspended_at, suspension_reason, suspended_by, created_at, profiles!publisher_profiles_id_fkey(full_name, phone, email, city, created_at)",
        { count: "exact" },
      );

    if (statuses.length > 0) q = q.in("verification_status", statuses);
    if (suspended === "true") q = q.eq("suspended", true);
    else if (suspended === "false") q = q.eq("suspended", false);

    const { data: rows, count, error } = await q
      .order("created_at", { ascending: true })
      .range(from, to);
    if (error) throw pgErrorToApiError(error);

    const list = rows ?? [];
    const ids = list.map((r) => r.id);
    const adminIds = [
      ...new Set(list.map((r) => r.suspended_by).filter((x): x is string => !!x)),
    ];

    const [{ data: hoardings }, { data: admins }] = await Promise.all([
      ids.length
        ? supabase
            .from("hoardings")
            .select("publisher_id, approval_status")
            .in("publisher_id", ids)
        : Promise.resolve({ data: [] as never[] }),
      adminIds.length
        ? supabase.from("profiles").select("id, full_name, email").in("id", adminIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const counts = tallyListingCounts(hoardings ?? []);
    const adminLabel = new Map(
      (admins ?? []).map((a) => [a.id, a.full_name ?? a.email ?? "SEEABLE"]),
    );

    const publishers = list.map((r) => {
      const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return toAdminPublisherRow(
        {
          id: r.id,
          full_name: prof?.full_name ?? null,
          phone: prof?.phone ?? null,
          email: prof?.email ?? null,
          city: prof?.city ?? null,
          created_at: r.created_at,
        },
        r,
        counts.get(r.id) ?? emptyListingCounts(),
        r.suspended_by ? (adminLabel.get(r.suspended_by) ?? "SEEABLE") : null,
      );
    });

    return {
      data: { publishers },
      meta: { pagination: paginationMeta(count ?? 0, { page, pageSize }) },
    };
  },
});
