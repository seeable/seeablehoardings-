/**
 * Admin projections — api-specification.md §24–§26.
 *
 * The pure helpers (`dashboardFromSummary`, `listingDisplayStatus`,
 * `reviewFlags`, `describeAction`) are unit-tested. The `to*Row` assemblers
 * read only what an Admin can already see under RLS (`is_admin()` branch) —
 * this runs as the caller's JWT, never the service role.
 *
 * Server-surface only; deliberately no `import "server-only"` (it breaks the
 * vitest runner) — matches lib/requests/projection.ts and lib/inventory/projection.ts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { mediaUrl } from "@/lib/inventory/projection";
import type {
  AdminActionRow,
  AdminDashboard,
  AdminKpis,
  AdminListingCounts,
  AdminListingRow,
  AdminPublisherRow,
  ListingDisplayStatus,
  ReviewFlag,
} from "@/lib/admin/types";

type Supa = SupabaseClient<Database>;
type HoardingRow = Database["public"]["Tables"]["hoardings"]["Row"];
type DashboardSummary =
  Database["public"]["Functions"]["admin_dashboard_summary"]["Returns"][number];
type KpisRow = Database["public"]["Functions"]["admin_kpis"]["Returns"][number];

// --- pure helpers -----------------------------------------------------------

/** admin_dashboard_summary() row → the AD-01 / api-spec §24.4 shape. */
export function dashboardFromSummary(
  s: DashboardSummary,
  generatedAt: string,
): AdminDashboard {
  return {
    listings: {
      total: Number(s.total_listings),
      pending_approval: Number(s.pending_listings),
      approved: Number(s.approved_listings),
      live_in_search: Number(s.live_in_search_listings),
    },
    requests: {
      total: Number(s.total_requests),
      confirmed: Number(s.confirmed_requests),
      live: Number(s.live_campaigns),
      confirmation_rate_pct: Number(s.request_to_confirmation_rate ?? 0),
    },
    publishers: {
      total: Number(s.total_publishers),
      verified: Number(s.verified_publishers),
      active: Number(s.active_publishers),
      pending_verification: Number(s.pending_verifications),
    },
    generated_at: generatedAt,
  };
}

/** admin_kpis() row → mvp-brd.md §14's seven KPIs (Phase 10). */
export function kpisFromRow(r: KpisRow, generatedAt: string): AdminKpis {
  return {
    publishers_onboarded: Number(r.publishers_onboarded),
    publishers_verified: Number(r.publishers_verified),
    live_approved_listings: Number(r.live_approved_listings),
    viewer_accounts: Number(r.viewer_accounts),
    requests_submitted: Number(r.requests_submitted),
    request_to_confirmation_rate_pct: Number(r.request_to_confirmation_rate ?? 0),
    median_publisher_response_hours:
      r.median_publisher_response_hours == null
        ? null
        : Number(r.median_publisher_response_hours),
    repeat_viewers: Number(r.repeat_viewers),
    repeat_publishers: Number(r.repeat_publishers),
    generated_at: generatedAt,
  };
}

/** Delisted and Publisher-paused are derived states over `approval_status`. */
export function listingDisplayStatus(h: {
  approval_status: string;
  is_paused: boolean;
  is_delisted: boolean;
}): ListingDisplayStatus {
  if (h.is_delisted) return "DELISTED";
  if (h.is_paused && h.approval_status === "APPROVED") return "PAUSED";
  return h.approval_status as ListingDisplayStatus;
}

/** INVENTORY-003 — the one-line reason a listing is / isn't in Viewer search,
 *  shown next to its status pill in AD-02 so "Approved" is never misleading. */
export function listingSecondaryAnnotation(h: {
  approval_status: string;
  is_paused: boolean;
  is_delisted: boolean;
  rejection_reason: string | null;
  delist_reason: string | null;
}): string | null {
  if (h.is_delisted) {
    return h.delist_reason
      ? `Delisted by SEEABLE — ${h.delist_reason}`
      : "Delisted by SEEABLE";
  }
  if (h.is_paused && h.approval_status === "APPROVED") {
    return "Paused by the Publisher — hidden from Discover";
  }
  if (h.approval_status === "REJECTED" && h.rejection_reason) {
    return `Rejected — ${h.rejection_reason}`;
  }
  return null;
}

/**
 * INVENTORY-002 + the one defensive check, and nothing more. api-spec §24.5:
 * there is no moderation rubric, so no quality-scoring / "suspicious" flags.
 */
export function reviewFlags(
  h: { site_intelligence_complete: boolean },
  pub: { verification_status: string; suspended: boolean } | null,
): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  if (!h.site_intelligence_complete) {
    flags.push({
      code: "SITE_INTELLIGENCE_INCOMPLETE",
      severity: "INFO",
      message:
        "Site Intelligence data is incomplete. This does not block approval (INVENTORY-002).",
    });
  }
  if (pub && pub.verification_status !== "VERIFIED") {
    flags.push({
      code: "PUBLISHER_UNVERIFIED",
      severity: "WARN",
      message:
        "The submitting Publisher is no longer Verified. Confirm before approving.",
    });
  }
  if (pub?.suspended) {
    flags.push({
      code: "PUBLISHER_SUSPENDED",
      severity: "WARN",
      message: "The submitting Publisher is currently suspended.",
    });
  }
  return flags;
}

const ACTION_VERB: Record<string, string> = {
  LISTING_APPROVED: "was approved",
  LISTING_REJECTED: "was rejected",
  HOARDING_DELISTED: "was delisted",
  HOARDING_RELISTED: "was re-listed",
  PUBLISHER_VERIFIED: "was verified",
  PUBLISHER_VERIFICATION_REJECTED: "verification was rejected",
  PUBLISHER_SUSPENDED: "was suspended",
  PUBLISHER_UNSUSPENDED: "was un-suspended",
};

/** AD-05 — reverse-chron plain-language feed, not a raw event log. */
export function describeAction(a: {
  action_type: string;
  target_hoarding_title: string | null;
  target_publisher_label: string | null;
  reason: string | null;
}): string {
  const verb = ACTION_VERB[a.action_type] ?? "was updated";
  const pub = a.target_publisher_label ?? "A publisher";
  const listingActions = new Set([
    "LISTING_APPROVED",
    "LISTING_REJECTED",
    "HOARDING_DELISTED",
    "HOARDING_RELISTED",
  ]);
  let sentence: string;
  if (listingActions.has(a.action_type)) {
    const title = a.target_hoarding_title
      ? `"${a.target_hoarding_title}"`
      : "a listing";
    sentence = `${pub}'s listing ${title} ${verb}`;
  } else {
    sentence = `${pub} ${verb}`;
  }
  if (a.reason && (a.action_type === "LISTING_REJECTED" || a.action_type === "HOARDING_DELISTED")) {
    sentence += ` — ${a.reason}`;
  }
  return `${sentence}.`;
}

// --- assemblers ------------------------------------------------------------

type MediaLite = {
  hoarding_id: string;
  storage_path: string;
  processing_status: string;
  is_primary: boolean;
};

export function toAdminListingRow(
  supabase: Supa,
  h: HoardingRow,
  ctx: {
    typeName: string;
    publisher:
      | {
          id: string;
          business_name: string | null;
          verification_status: string;
          suspended: boolean;
        }
      | null;
    media: MediaLite[];
  },
): AdminListingRow {
  const mine = ctx.media.filter((m) => m.hoarding_id === h.id);
  const watermarked = mine.filter((m) => m.processing_status === "WATERMARKED");
  const failed = mine.filter((m) => m.processing_status === "FAILED");
  const processing = mine.filter(
    (m) =>
      m.processing_status !== "WATERMARKED" && m.processing_status !== "FAILED",
  );
  const publicMedia = watermarked
    .map((m) => ({ url: mediaUrl(supabase, m.storage_path), is_primary: m.is_primary }))
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

  return {
    id: h.id,
    title: h.title,
    approval_status: h.approval_status,
    is_paused: h.is_paused,
    is_delisted: h.is_delisted,
    display_status: listingDisplayStatus(h),
    secondary_annotation: listingSecondaryAnnotation(h),
    rejection_reason: h.rejection_reason,
    delist_reason: h.delist_reason,
    type: { code: h.type_code, display_name: ctx.typeName },
    publisher: ctx.publisher
      ? {
          id: ctx.publisher.id,
          business_name: ctx.publisher.business_name,
          verification_status: ctx.publisher.verification_status,
          suspended: ctx.publisher.suspended,
        }
      : {
          id: h.publisher_id,
          business_name: null,
          verification_status: "UNVERIFIED",
          suspended: false,
        },
    site_intelligence_complete: h.site_intelligence_complete,
    review_flags: reviewFlags(h, ctx.publisher),
    media_summary: {
      total: mine.length,
      watermarked: watermarked.length,
      processing: processing.length,
      failed: failed.length,
    },
    primary_media_url: publicMedia[0]?.url ?? null,
    media: publicMedia,
    description: h.description,
    size: h.size,
    price: h.price,
    price_unit: h.price_unit,
    locality: h.locality,
    city: h.city,
    latitude: h.latitude,
    longitude: h.longitude,
    address_text: h.address_text,
    attributes: (h.attributes ?? {}) as Record<string, unknown>,
    site_intelligence: (h.site_intelligence ?? {}) as Record<string, unknown>,
    approved_by: h.approved_by,
    delisted_by: h.delisted_by,
    submitted_at:
      h.approval_status === "PENDING_REVIEW" ? h.updated_at : null,
    created_at: h.created_at,
  };
}

export function toAdminPublisherRow(
  p: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    created_at: string;
  },
  pp: {
    business_name: string | null;
    business_type: string | null;
    verification_status: string;
    verified_at: string | null;
    verification_submitted_at: string | null;
    verification_rejection_reason: string | null;
    verification_document_path: string | null;
    suspended: boolean;
    suspended_at: string | null;
    suspension_reason: string | null;
    suspended_by: string | null;
  },
  counts: AdminListingCounts,
  suspendedByLabel: string | null,
): AdminPublisherRow {
  return {
    id: p.id,
    full_name: p.full_name,
    phone: p.phone,
    email: p.email,
    city: p.city,
    business_name: pp.business_name,
    business_type: pp.business_type,
    verification_status: pp.verification_status,
    verified_at: pp.verified_at,
    verification_submitted_at: pp.verification_submitted_at,
    verification_rejection_reason: pp.verification_rejection_reason,
    has_verification_document: !!pp.verification_document_path,
    suspended: pp.suspended,
    suspended_at: pp.suspended_at,
    suspension_reason: pp.suspension_reason,
    suspended_by: pp.suspended_by
      ? { id: pp.suspended_by, label: suspendedByLabel ?? "SEEABLE" }
      : null,
    listing_counts: counts,
    created_at: p.created_at,
  };
}

export function emptyListingCounts(): AdminListingCounts {
  return { draft: 0, pending_review: 0, approved: 0, rejected: 0 };
}

export function tallyListingCounts(
  rows: { publisher_id: string; approval_status: string }[],
): Map<string, AdminListingCounts> {
  const m = new Map<string, AdminListingCounts>();
  for (const r of rows) {
    const c = m.get(r.publisher_id) ?? emptyListingCounts();
    if (r.approval_status === "DRAFT") c.draft++;
    else if (r.approval_status === "PENDING_REVIEW") c.pending_review++;
    else if (r.approval_status === "APPROVED") c.approved++;
    else if (r.approval_status === "REJECTED") c.rejected++;
    m.set(r.publisher_id, c);
  }
  return m;
}

export function toAdminActionRow(
  a: Database["public"]["Tables"]["admin_actions"]["Row"],
  ctx: { hoardingTitle: string | null; publisherLabel: string | null },
): AdminActionRow {
  const base = {
    action_type: a.action_type,
    target_hoarding_title: ctx.hoardingTitle,
    target_publisher_label: ctx.publisherLabel,
    reason: a.reason,
  };
  return {
    id: a.id,
    action_type: a.action_type,
    admin_label: a.admin_label,
    target_hoarding_id: a.target_hoarding_id,
    target_hoarding_title: ctx.hoardingTitle,
    target_publisher_id: a.target_publisher_id,
    target_publisher_label: ctx.publisherLabel,
    reason: a.reason,
    created_at: a.created_at,
    description: describeAction(base),
  };
}
