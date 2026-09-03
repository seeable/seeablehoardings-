import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env.server";
import { computeGates, type VerificationGates } from "@/lib/auth/gates";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Tables"]["profiles"]["Row"]["role"];

export interface SessionUser {
  id: string;
  role: Role;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
  verification: VerificationGates;
  publisher_profile: {
    business_name: string | null;
    verification_status: Database["public"]["Tables"]["publisher_profiles"]["Row"]["verification_status"];
    verified_at: string | null;
    suspended: boolean;
  } | null;
}

/**
 * The single source of identity + role + gates for every server surface
 * (api-specification.md §5.11). `cache()` dedupes it within one request.
 * Returns null when there is no valid session.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, email, phone, full_name, city, created_at, updated_at")
    .eq("id", user.id)
    .single();

  // The handle_new_user trigger creates this row transactionally with the
  // auth.users insert. A missing row means the trigger has not run yet
  // (a race on the very first request after signup) — treat as no session.
  if (!profile) return null;

  let publisherProfile: SessionUser["publisher_profile"] = null;
  if (profile.role === "PUBLISHER") {
    const { data: pp } = await supabase
      .from("publisher_profiles")
      .select("business_name, verification_status, verified_at, suspended")
      .eq("id", user.id)
      .single();
    publisherProfile = pp ?? null;
  }

  return {
    id: profile.id,
    role: profile.role as Role,
    email: profile.email,
    phone: profile.phone,
    full_name: profile.full_name,
    city: profile.city,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    publisher_profile: publisherProfile,
    verification: computeGates(
      profile.role as Role,
      publisherProfile
        ? {
            verification_status: publisherProfile.verification_status,
            suspended: publisherProfile.suspended,
          }
        : null,
      { otpRequired: serverEnv.AUTH_OTP_ENABLED === true },
    ),
  };
});

/** Where a role lands after login (api-specification.md §5.11, AUTH-03). */
export function homePathForRole(role: Role): string {
  switch (role) {
    case "PUBLISHER":
      return "/publisher/dashboard";
    case "ADMIN":
      return "/admin/overview";
    default:
      return "/discover";
  }
}
