/** Admin Platform shapes — api-specification.md §24–§26, docs/05 AD-01..05. */

/** hoardings.approval_status ∪ the two derived display states. */
export type ListingDisplayStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PAUSED"
  | "DELISTED";

export const LISTING_TABS = [
  "ALL",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "DELISTED",
] as const;
export type ListingTab = (typeof LISTING_TABS)[number];

export const PUBLISHER_TABS = [
  "ALL",
  "PENDING",
  "VERIFIED",
  "SUSPENDED",
] as const;
export type PublisherTab = (typeof PUBLISHER_TABS)[number];

/** AD-01's four cards, plus the api-spec §24.4 breakdown fields. */
export interface AdminDashboard {
  listings: {
    total: number;
    pending_approval: number;
    approved: number;
    live_in_search: number;
  };
  requests: {
    total: number;
    confirmed: number;
    live: number;
    confirmation_rate_pct: number;
  };
  publishers: {
    total: number;
    verified: number;
    active: number;
    pending_verification: number;
  };
  generated_at: string;
}

export type ReviewFlagSeverity = "INFO" | "WARN";

export interface ReviewFlag {
  code: string;
  severity: ReviewFlagSeverity;
  message: string;
}

export interface AdminMediaSummary {
  total: number;
  watermarked: number;
  processing: number;
  failed: number;
}

/** One row of GET /api/v1/admin/hoardings — carries the full AD-04 review
 *  payload so the drawer needs no second fetch (fine at 50–200-listing scale). */
export interface AdminListingRow {
  id: string;
  title: string;
  approval_status: string;
  is_paused: boolean;
  is_delisted: boolean;
  display_status: ListingDisplayStatus;
  /** INVENTORY-003 — why a non-APPROVED-looking listing is/ isn't in search. */
  secondary_annotation: string | null;
  rejection_reason: string | null;
  delist_reason: string | null;
  type: { code: string; display_name: string };
  publisher: {
    id: string;
    business_name: string | null;
    verification_status: string;
    suspended: boolean;
  };
  site_intelligence_complete: boolean;
  review_flags: ReviewFlag[];
  media_summary: AdminMediaSummary;
  primary_media_url: string | null;
  media: { url: string; is_primary: boolean }[];
  description: string | null;
  size: string | null;
  price: number | null;
  price_unit: string;
  locality: string | null;
  city: string;
  latitude: number | null;
  longitude: number | null;
  address_text: string | null;
  attributes: Record<string, unknown>;
  site_intelligence: Record<string, unknown>;
  approved_by: string | null;
  delisted_by: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface AdminListingCounts {
  draft: number;
  pending_review: number;
  approved: number;
  rejected: number;
}

/** One row of GET /api/v1/admin/publishers — full contact detail (Admin only). */
export interface AdminPublisherRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  business_name: string | null;
  business_type: string | null;
  verification_status: string;
  verified_at: string | null;
  verification_submitted_at: string | null;
  verification_rejection_reason: string | null;
  has_verification_document: boolean;
  suspended: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
  suspended_by: { id: string; label: string } | null;
  listing_counts: AdminListingCounts;
  created_at: string;
}

export type AdminActionType =
  | "LISTING_APPROVED"
  | "LISTING_REJECTED"
  | "PUBLISHER_VERIFIED"
  | "PUBLISHER_VERIFICATION_REJECTED"
  | "PUBLISHER_SUSPENDED"
  | "PUBLISHER_UNSUSPENDED"
  | "HOARDING_DELISTED"
  | "HOARDING_RELISTED";

export interface AdminActionRow {
  id: string;
  action_type: string;
  admin_label: string;
  target_hoarding_id: string | null;
  target_hoarding_title: string | null;
  target_publisher_id: string | null;
  target_publisher_label: string | null;
  reason: string | null;
  created_at: string;
  /** Plain past-tense sentence for the AD-05 feed. */
  description: string;
}
