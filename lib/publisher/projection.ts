/**
 * The Publisher profile resource (api-spec §22.2) — `profiles` + the trust
 * fields from `publisher_profiles`, with `can_submit_listings` derived the same
 * way `lib/auth/gates.ts` does. `suspended_by` is never projected (§22.2).
 * Server-surface only — imported by the route handlers.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { PublisherProfile, VerificationStatus } from "@/lib/publisher/types";

type Supa = SupabaseClient<Database>;

export async function buildPublisherProfile(
  supabase: Supa,
  userId: string,
): Promise<PublisherProfile | null> {
  const [{ data: p }, { data: pp }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, full_name, phone, email, city, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("publisher_profiles")
      .select(
        "business_name, business_type, verification_status, verified_at, verification_submitted_at, verification_rejection_reason, suspended, suspended_at, suspension_reason",
      )
      .eq("id", userId)
      .maybeSingle(),
  ]);
  if (!p || !pp) return null;

  const status = pp.verification_status as VerificationStatus;
  return {
    id: p.id,
    role: p.role,
    full_name: p.full_name,
    phone: p.phone,
    email: p.email,
    city: p.city,
    created_at: p.created_at,
    updated_at: p.updated_at,
    business_name: pp.business_name,
    business_type: pp.business_type,
    verification_status: status,
    verified_at: pp.verified_at,
    verification_submitted_at: pp.verification_submitted_at,
    verification_rejection_reason: pp.verification_rejection_reason,
    suspended: pp.suspended,
    suspended_at: pp.suspended_at,
    suspension_reason: pp.suspension_reason,
    can_submit_listings: status === "VERIFIED" && !pp.suspended,
  };
}
