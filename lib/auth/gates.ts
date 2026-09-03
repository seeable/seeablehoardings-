import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Tables"]["profiles"]["Row"]["role"];
type VerificationStatus =
  Database["public"]["Tables"]["publisher_profiles"]["Row"]["verification_status"];

export interface VerificationGates {
  /** Decision D2: OTP is off for the MVP, so this is false unless overridden. */
  otp_required: boolean;
  /** null for VIEWER and ADMIN. */
  publisher_verification_status: VerificationStatus | null;
  publisher_suspended: boolean;
  /** PUBLISHER, VERIFIED, not suspended (OWNER-004). */
  can_submit_listings: boolean;
  /** Any authenticated VIEWER (Decision D2 — no AUTH_VERIFICATION_REQUIRED gate). */
  can_create_requests: boolean;
}

export interface PublisherGateInput {
  verification_status: VerificationStatus;
  suspended: boolean;
}

/**
 * The server's own answer to the gates it enforces at action time
 * (api-specification.md §5.11). Derived on every read, so it cannot drift from
 * the rule — and a client that ignores it changes nothing, the gate still fires.
 * Pure: no env import, so it is unit-testable without the server bundle.
 */
export function computeGates(
  role: Role,
  publisherProfile: PublisherGateInput | null,
  opts: { otpRequired?: boolean } = {},
): VerificationGates {
  const isPublisher = role === "PUBLISHER";
  const verified = publisherProfile?.verification_status === "VERIFIED";
  const suspended = publisherProfile?.suspended ?? false;

  return {
    otp_required: opts.otpRequired ?? false,
    publisher_verification_status: isPublisher
      ? (publisherProfile?.verification_status ?? "UNVERIFIED")
      : null,
    publisher_suspended: isPublisher ? suspended : false,
    can_submit_listings: isPublisher && verified && !suspended,
    can_create_requests: role === "VIEWER",
  };
}
