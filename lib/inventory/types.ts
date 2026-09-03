/** Shared inventory shapes — used by the facade projection and the client. */
import type { Database } from "@/lib/supabase/database.types";

export type HoardingRow = Database["public"]["Tables"]["hoardings"]["Row"];
export type HoardingTypeRow =
  Database["public"]["Tables"]["hoarding_types"]["Row"];

export const APPROVAL_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;

/** PB-02 tab keys — the derived Paused/Delisted views layer on APPROVED. */
export type ListingTab =
  | "ALL"
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "PAUSED"
  | "REJECTED"
  | "DELISTED";

export interface Blocker {
  code: string;
  message: string;
}

export interface MediaAsset {
  id: string;
  media_type: string;
  url: string | null;
  is_primary: boolean;
  display_order: number;
  processing_status: string;
  watermarked_at: string | null;
  has_original: boolean;
  created_at: string;
}

export interface HoardingTypeView {
  code: string;
  display_name: string;
  is_digital: boolean;
  is_listable: boolean;
  required_attribute_keys: string[];
  description: string | null;
}

/** api-specification.md §11.3 — the owner/Admin representation. */
export interface HoardingOwnerView extends HoardingRow {
  type: { code: string; display_name: string; is_digital: boolean };
  media: MediaAsset[];
  submission_readiness: {
    is_submittable: boolean;
    blockers: Blocker[];
  };
  missing_attribute_keys: string[];
  pending_request_count: number;
  is_edit_frozen: boolean;
}

/** The subset of `HoardingOwnerView` a Publisher's list needs (PB-02). */
export interface HoardingListItem {
  id: string;
  title: string;
  type_code: string;
  type_display_name: string;
  approval_status: string;
  is_paused: boolean;
  is_delisted: boolean;
  effective_status: ListingTab;
  price: number | null;
  price_unit: string;
  primary_media_url: string | null;
  pending_request_count: number;
  is_edit_frozen: boolean;
  rejection_reason: string | null;
  updated_at: string;
}

/** The status label a Publisher actually sees (Paused/Delisted win over APPROVED). */
export function effectiveStatus(h: {
  approval_status: string;
  is_paused: boolean;
  is_delisted: boolean;
}): ListingTab {
  if (h.is_delisted) return "DELISTED";
  if (h.approval_status === "APPROVED" && h.is_paused) return "PAUSED";
  return h.approval_status as ListingTab;
}
