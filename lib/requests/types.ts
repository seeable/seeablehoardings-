/**
 * Request Engine — shared shapes for the /api/v1/requests facade and the
 * VW-04/05 + PB-06/07 screens. api-specification.md §16.3, §18.4, §22.4.
 *
 * `status_label` and `available_actions` are computed once, server-side
 * (lib/requests/projection.ts), so no client re-implements the state machine
 * (§16.3). Money is a `number | null` here — the same choice Phase 6 made for
 * `hoardings.price` — not the api-spec's money-string.
 */

export type RequestStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "REJECTED"
  | "EXPIRED"
  | "LIVE"
  | "COMPLETED";

export type RequestAction =
  | "ACCEPT"
  | "REJECT"
  | "COMPLETE"
  | "SET_AMOUNT_AGREED";

export type RequestActorRole = "VIEWER" | "PUBLISHER" | "ADMIN";

/** Non-secret mirror of `default_response_sla()` — for "usually within N hours"
 *  copy only. The DB function is the source of truth for the actual deadline. */
export const REQUEST_SLA_HOURS = 48;

/** Below this many hours to the SLA deadline the PB-06 countdown turns
 *  `warning-700` (docs/04 PB-06). */
export const SLA_URGENT_HOURS = 4;

export interface RequestHoardingSummary {
  id: string;
  title: string;
  type_code: string;
  type_display_name: string;
  locality: string | null;
  city: string | null;
  price: number | null;
  price_unit: string | null;
  currency: "INR";
  primary_media_url: string | null;
  /** False when the listing is now paused/delisted — the request still renders
   *  its subject (§23.3), the client shows "no longer available". */
  is_currently_listed: boolean;
}

export interface RequestResource {
  id: string;
  hoarding: RequestHoardingSummary;
  /** The Viewer's display name — visible to the owning Publisher and to the
   *  Viewer themselves, never a third party. `full_name` only (§23.4). */
  viewer: { full_name: string | null } | null;
  /** `business_name` only — the Viewer never receives Publisher contact
   *  details through this API at any state (§23.4). */
  publisher: { business_name: string | null };
  start_date: string;
  end_date: string;
  duration_days: number;
  status: RequestStatus;
  status_label: string;
  message: string | null;
  rejection_reason: string | null;
  amount_agreed: number | null;
  sla_deadline: string | null;
  /** Derived. Negative once overdue and the sweep has not yet run (§22.4). */
  sla_hours_remaining: number | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  rejected_at: string | null;
  expired_at: string | null;
  live_at: string | null;
  completed_at: string | null;
  available_actions: RequestAction[];
}

export interface RequestHistoryEntry {
  from_status: RequestStatus | null;
  to_status: RequestStatus;
  changed_at: string;
  /** `{ id: null, role: null }` + `note: "system"` for a pg_cron transition. */
  actor: { id: string | null; role: RequestActorRole | null };
  note: string | null;
}

/** api-spec §18.4 — the mapping lives here so copy stays centrally controlled. */
const VIEWER_LABEL: Record<RequestStatus, string> = {
  REQUESTED: "Pending",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  LIVE: "Campaign Period",
  COMPLETED: "Completed",
};

const PUBLISHER_LABEL: Record<RequestStatus, string> = {
  REQUESTED: "Awaiting your response",
  CONFIRMED: "Confirmed",
  REJECTED: "Declined",
  EXPIRED: "Expired — no response",
  LIVE: "Campaign Period",
  COMPLETED: "Completed",
};

export function statusLabel(
  status: RequestStatus,
  role: RequestActorRole,
): string {
  return role === "PUBLISHER"
    ? PUBLISHER_LABEL[status]
    : VIEWER_LABEL[status];
}

/** Inclusive-inclusive, matching `daterange(start, end, '[]')` and mvp-prd §12. */
export function durationDays(startDate: string, endDate: string): number {
  const ms =
    new Date(`${endDate}T00:00:00Z`).getTime() -
    new Date(`${startDate}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Do two inclusive date ranges share at least one day? (mvp-prd §12 / §10.) */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
