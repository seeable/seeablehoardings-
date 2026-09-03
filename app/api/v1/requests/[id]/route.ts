import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { requireRow } from "@/lib/api/authz";
import { pgErrorToApiError } from "@/lib/db/errors";
import { requestActionSchema } from "@/lib/requests/schema";
import {
  availableActions,
  toRequestResource,
  typeNameMap,
} from "@/lib/requests/projection";
import {
  durationDays,
  statusLabel,
  type RequestActorRole,
  type RequestResource,
  type RequestStatus,
} from "@/lib/requests/types";
import type { RequestActionInput } from "@/lib/requests/schema";
import { todayIST } from "@/lib/date";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Supa = SupabaseClient<Database>;

/** Load the full Request resource for a caller, or null if it is not theirs.
 *  VIEWER/PUBLISHER read their scoped view; ADMIN (COMPLETE only, §18.2 / D10)
 *  assembles it directly since `requests` RLS has no `is_admin()` clause. */
async function loadResource(
  supabase: Supa,
  id: string,
  role: RequestActorRole,
  typeName: Map<string, string>,
  now: Date,
): Promise<RequestResource | null> {
  const today = todayIST(now);

  if (role !== "ADMIN") {
    const view = role === "VIEWER" ? "viewer_request_list" : "publisher_inbox";
    const { data, error } = await supabase
      .from(view)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw pgErrorToApiError(error);
    return data
      ? toRequestResource(supabase, data, { role, typeName, today, now })
      : null;
  }

  const { data: raw } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!raw) return null;
  const { data: h } = await supabase
    .from("hoardings")
    .select(
      "type_code, title, locality, city, price, price_unit, approval_status, is_paused, is_delisted",
    )
    .eq("id", raw.hoarding_id)
    .maybeSingle();

  const status = raw.status as RequestStatus;
  return {
    id: raw.id,
    hoarding: {
      id: raw.hoarding_id,
      title: h?.title ?? "Listing",
      type_code: h?.type_code ?? "",
      type_display_name: typeName.get(h?.type_code ?? "") ?? h?.type_code ?? "",
      locality: h?.locality ?? null,
      city: h?.city ?? null,
      price: h?.price ?? null,
      price_unit: h?.price_unit ?? null,
      currency: "INR",
      primary_media_url: null,
      is_currently_listed:
        !!h &&
        h.approval_status === "APPROVED" &&
        !h.is_paused &&
        !h.is_delisted,
    },
    viewer: null,
    publisher: { business_name: null },
    start_date: raw.start_date,
    end_date: raw.end_date,
    duration_days: durationDays(raw.start_date, raw.end_date),
    status,
    status_label: statusLabel(status, "ADMIN"),
    message: raw.message,
    rejection_reason: raw.rejection_reason,
    amount_agreed: raw.amount_agreed,
    sla_deadline: raw.sla_deadline,
    sla_hours_remaining: null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    confirmed_at: raw.confirmed_at,
    rejected_at: raw.rejected_at,
    expired_at: raw.expired_at,
    live_at: raw.live_at,
    completed_at: raw.completed_at,
    available_actions: availableActions(status, "ADMIN", raw.start_date, today),
  };
}

/**
 * GET /api/v1/requests/{id} — api-specification.md §23.3.
 * The owning Viewer or owning Publisher only; Admin receives `404` (§6.6).
 */
export const GET = defineRoute<undefined, undefined, { id: string }>({
  path: "/api/v1/requests/{id}",
  auth: true,
  rateLimit: { perMinute: 120 },
  handler: async ({ supabase, user, params, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);
    if (user!.role === "ADMIN") throw ApiError.of("REQUEST_NOT_FOUND");

    const typeName = await typeNameMap(supabase);
    const request = await loadResource(
      supabase,
      params.id,
      user!.role as RequestActorRole,
      typeName,
      new Date(),
    );
    requireRow(request, "REQUEST_NOT_FOUND");
    return { data: { request } };
  },
});

const KNOWN_ACTIONS = ["ACCEPT", "REJECT", "COMPLETE", "SET_AMOUNT_AGREED"];
const PUBLISHER_ONLY = ["ACCEPT", "REJECT", "SET_AMOUNT_AGREED"];

/**
 * PATCH /api/v1/requests/{id} — api-specification.md §20. One endpoint, four
 * actions. Every transition is a `SECURITY DEFINER` function — `requests` has no
 * client UPDATE grant. Error precedence: unknown action (422) → role (403) →
 * ownership (403/404) → state (409) → business precondition (409).
 */
export const PATCH = defineRoute<
  undefined,
  RequestActionInput,
  { id: string }
>({
  path: "/api/v1/requests/{id}",
  auth: ["PUBLISHER", "ADMIN"],
  body: requestActionSchema,
  rateLimit: { perMinute: 60 },
  handler: async ({ supabase, user, params, body, logResource }) => {
    if (!UUID.test(params.id)) throw ApiError.of("VALIDATION_ERROR");
    logResource(params.id);

    const action = body.action.toUpperCase();
    if (action === "CANCEL") throw ApiError.of("REQUEST_CANCEL_UNSUPPORTED");
    if (!KNOWN_ACTIONS.includes(action)) {
      throw ApiError.of("REQUEST_ACTION_INVALID");
    }
    if (body.reason !== undefined && action !== "REJECT") {
      throw ApiError.of("REQUEST_ACTION_INVALID", "`reason` is only valid with REJECT.");
    }
    if (body.amount_agreed !== undefined && action !== "SET_AMOUNT_AGREED") {
      throw ApiError.of(
        "REQUEST_ACTION_INVALID",
        "`amount_agreed` is only valid with SET_AMOUNT_AGREED.",
      );
    }
    if (action === "SET_AMOUNT_AGREED" && body.amount_agreed === undefined) {
      throw ApiError.of("REQUEST_ACTION_INVALID", "`amount_agreed` is required.");
    }

    if (user!.role === "ADMIN" && PUBLISHER_ONLY.includes(action)) {
      throw ApiError.of("FORBIDDEN_ROLE");
    }

    let error: unknown;
    switch (action) {
      case "ACCEPT":
        ({ error } = await supabase.rpc("confirm_request", {
          p_request_id: params.id,
        }));
        break;
      case "REJECT":
        ({ error } = await supabase.rpc("reject_request", {
          p_request_id: params.id,
          p_reason: body.reason,
        }));
        break;
      case "COMPLETE":
        ({ error } = await supabase.rpc("mark_request_completed", {
          p_request_id: params.id,
        }));
        break;
      case "SET_AMOUNT_AGREED":
        ({ error } = await supabase.rpc("set_request_amount_agreed", {
          p_request_id: params.id,
          p_amount: body.amount_agreed!,
        }));
        break;
    }
    if (error) throw pgErrorToApiError(error as never);

    const typeName = await typeNameMap(supabase);
    const request = await loadResource(
      supabase,
      params.id,
      user!.role as RequestActorRole,
      typeName,
      new Date(),
    );
    // An Admin COMPLETE succeeds but the request is not Admin-readable (§6.6 /
    // D10) — the transition is what matters; echo a minimal confirmation.
    if (!request) {
      return { data: { request: { id: params.id, status: "COMPLETED" } } };
    }
    return { data: { request } };
  },
});
