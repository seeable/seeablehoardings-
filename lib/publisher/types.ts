/** Publisher Platform shapes — api-specification.md §22. */

export type VerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED";

/** PB-08 Business Type select (docs/04 PB-08 — a minimal set, not KYC). */
export const BUSINESS_TYPES = [
  "Sole proprietor",
  "Partnership",
  "Private limited company",
  "Advertising agency",
  "Other",
] as const;

export interface ProfileResource {
  id: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublisherProfile extends ProfileResource {
  business_name: string | null;
  business_type: string | null;
  verification_status: VerificationStatus;
  verified_at: string | null;
  verification_submitted_at: string | null;
  verification_rejection_reason: string | null;
  suspended: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
  /** PUBLISHER, VERIFIED, not suspended (OWNER-004). */
  can_submit_listings: boolean;
}

export interface PublisherSummary {
  listings: {
    total: number;
    live_in_search: number;
    pending_approval: number;
    draft: number;
    rejected: number;
  };
  requests: {
    awaiting_response: number;
    confirmed: number;
    live: number;
    completed: number;
    expired: number;
    rejected: number;
  };
  /** SUM of amount_agreed where recorded — NOT revenue (api-spec §22.6). */
  confirmed_value: { amount: number; currency: "INR"; basis: string };
  /** This calendar month (IST), confirmed campaigns — the PB-01 metric card. */
  confirmed_this_month: number;
  verification_status: VerificationStatus;
  suspended: boolean;
}

export type AttentionKind = "sla" | "rejected_listing";

export interface AttentionItem {
  kind: AttentionKind;
  id: string;
  title: string;
  detail: string;
  href: string;
}
