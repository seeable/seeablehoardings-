import { defineRoute } from "@/lib/api/facade";
import { pgErrorToApiError } from "@/lib/db/errors";
import { deriveSummary } from "@/lib/publisher/summary";
import type { VerificationStatus } from "@/lib/publisher/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/publishers/me/summary — api-specification.md §22.6. Counts drawn
 * from the Publisher's own `hoardings` and `requests` (both RLS-scoped to
 * `publisher_id = auth.uid()`). No new analytics endpoint — `confirmed_value`
 * is `SUM(amount_agreed WHERE recorded)`, explicitly not revenue.
 */
export const GET = defineRoute({
  path: "/api/v1/publishers/me/summary",
  auth: "PUBLISHER",
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, user }) => {
    const [listingsRes, requestsRes, ppRes] = await Promise.all([
      supabase
        .from("hoardings")
        .select("approval_status, is_paused, is_delisted")
        .eq("publisher_id", user!.id),
      supabase
        .from("requests")
        .select("status, amount_agreed, confirmed_at")
        .eq("publisher_id", user!.id),
      supabase
        .from("publisher_profiles")
        .select("verification_status, suspended")
        .eq("id", user!.id)
        .single(),
    ]);
    if (listingsRes.error) throw pgErrorToApiError(listingsRes.error);
    if (requestsRes.error) throw pgErrorToApiError(requestsRes.error);
    if (ppRes.error) throw pgErrorToApiError(ppRes.error);

    const summary = deriveSummary(
      listingsRes.data ?? [],
      requestsRes.data ?? [],
      ppRes.data.verification_status as VerificationStatus,
      ppRes.data.suspended,
    );
    return { data: { summary } };
  },
});
