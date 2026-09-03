/**
 * Reshape a `viewer_request_list` / `publisher_inbox` row into the Request
 * resource (api-specification.md §16.3), with `status_label` and
 * `available_actions` computed once here so no client re-derives the state
 * machine (§16.3, §20.3). Server-surface only — imported by the route handlers.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { mediaUrl } from "@/lib/inventory/projection";
import {
  durationDays,
  statusLabel,
  type RequestAction,
  type RequestActorRole,
  type RequestHistoryEntry,
  type RequestResource,
  type RequestStatus,
} from "@/lib/requests/types";

type Supa = SupabaseClient<Database>;
type ViewerRow = Database["public"]["Views"]["viewer_request_list"]["Row"];
type InboxRow = Database["public"]["Views"]["publisher_inbox"]["Row"];
export type RequestRow = ViewerRow | InboxRow;

/** `code → display_name` for every hoarding type (a ~12-row reference table). */
export async function typeNameMap(supabase: Supa): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("hoarding_types")
    .select("code, display_name");
  return new Map((data ?? []).map((t) => [t.code, t.display_name]));
}

export function slaHoursRemaining(
  deadline: string | null,
  now: Date,
): number | null {
  if (!deadline) return null;
  return (
    Math.round(((new Date(deadline).getTime() - now.getTime()) / 3_600_000) * 10) /
    10
  );
}

/** The subset of actions this caller may perform right now (§16.3, §20.3). */
export function availableActions(
  status: RequestStatus,
  role: RequestActorRole,
  startDate: string,
  today: string,
): RequestAction[] {
  if (role === "VIEWER") return [];
  const started = startDate <= today;
  if (role === "ADMIN") {
    return status === "LIVE" || (status === "CONFIRMED" && started)
      ? ["COMPLETE"]
      : [];
  }
  // Publisher — ownership already established by the route / RLS.
  switch (status) {
    case "REQUESTED":
      return ["ACCEPT", "REJECT"];
    case "CONFIRMED":
      return started ? ["COMPLETE", "SET_AMOUNT_AGREED"] : ["SET_AMOUNT_AGREED"];
    case "LIVE":
      return ["COMPLETE", "SET_AMOUNT_AGREED"];
    case "COMPLETED":
      return ["SET_AMOUNT_AGREED"];
    default:
      return [];
  }
}

export function toRequestResource(
  supabase: Supa,
  row: RequestRow,
  ctx: {
    role: RequestActorRole;
    typeName: Map<string, string>;
    today: string;
    now: Date;
  },
): RequestResource {
  const status = row.status as RequestStatus;
  const startDate = row.start_date as string;
  const endDate = row.end_date as string;
  const viewerName = "viewer_name" in row ? row.viewer_name : null;
  const businessName =
    "publisher_business_name" in row ? row.publisher_business_name : null;
  const typeCode = row.hoarding_type_code ?? "";
  const mediaPath = row.hoarding_primary_media_path;

  return {
    id: row.id as string,
    hoarding: {
      id: row.hoarding_id as string,
      title: row.hoarding_title ?? "Listing",
      type_code: typeCode,
      type_display_name: ctx.typeName.get(typeCode) ?? typeCode,
      locality: row.hoarding_locality,
      city: row.hoarding_city,
      price: row.hoarding_price,
      price_unit: row.hoarding_price_unit,
      currency: "INR",
      primary_media_url: mediaPath ? mediaUrl(supabase, mediaPath) : null,
      is_currently_listed: row.hoarding_is_listed ?? false,
    },
    viewer: ctx.role === "PUBLISHER" ? { full_name: viewerName } : null,
    publisher: { business_name: businessName },
    start_date: startDate,
    end_date: endDate,
    duration_days: durationDays(startDate, endDate),
    status,
    status_label: statusLabel(status, ctx.role),
    message: row.message,
    rejection_reason: row.rejection_reason,
    amount_agreed: row.amount_agreed,
    sla_deadline: row.sla_deadline,
    sla_hours_remaining:
      status === "REQUESTED" ? slaHoursRemaining(row.sla_deadline, ctx.now) : null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    confirmed_at: row.confirmed_at,
    rejected_at: row.rejected_at,
    expired_at: row.expired_at,
    live_at: row.live_at,
    completed_at: row.completed_at,
    available_actions: availableActions(status, ctx.role, startDate, ctx.today),
  };
}

type HistoryRow = {
  from_status: string | null;
  to_status: string;
  changed_at: string;
  note: string | null;
  actor_id: string | null;
  actor_role: string | null;
};

export function toHistoryEntries(rows: HistoryRow[]): RequestHistoryEntry[] {
  return rows.map((r) => ({
    from_status: (r.from_status as RequestStatus | null) ?? null,
    to_status: r.to_status as RequestStatus,
    changed_at: r.changed_at,
    actor: {
      id: r.actor_id ?? null,
      role: (r.actor_role as RequestActorRole | null) ?? null,
    },
    note: r.actor_id ? r.note : (r.note ?? "system"),
  }));
}
