import { defineRoute } from "@/lib/api/facade";
import { ApiError } from "@/lib/api/errors";
import { requireRow } from "@/lib/api/authz";
import { pgErrorToApiError } from "@/lib/db/errors";
import { createRequestSchema } from "@/lib/requests/schema";
import { toRequestResource, typeNameMap } from "@/lib/requests/projection";
import type { CreateRequestInput } from "@/lib/requests/schema";
import type { RequestResource } from "@/lib/requests/types";
import { todayIST } from "@/lib/date";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const IDEMPOTENT_ENDPOINT = "POST /api/v1/requests";

/**
 * POST /api/v1/requests — api-specification.md §17.
 * Every rule (visibility, past-date, confirmed-overlap, VIEWER-002) is enforced
 * by `validate_request_creation` (BEFORE INSERT) or a constraint, so this is one
 * atomic `INSERT`. An `Idempotency-Key` header makes a retry safe; even without
 * one, the `requests_one_pending_per_viewer_hoarding` index absorbs a concurrent
 * double-submit.
 */
export const POST = defineRoute<undefined, CreateRequestInput>({
  path: "/api/v1/requests",
  auth: "VIEWER",
  body: createRequestSchema,
  rateLimit: { perMinute: 10 },
  handler: async ({ req, supabase, user, body, logResource }) => {
    const idemKey = req.headers.get("idempotency-key");
    if (idemKey !== null && (idemKey.length < 1 || idemKey.length > 255)) {
      throw ApiError.of("IDEMPOTENCY_KEY_INVALID");
    }

    if (idemKey) {
      const { data: prior } = await supabase
        .from("api_idempotency_keys")
        .select("status_code, response_json")
        .eq("user_id", user!.id)
        .eq("endpoint", IDEMPOTENT_ENDPOINT)
        .eq("key", idemKey)
        .maybeSingle();
      if (prior) {
        return {
          data: prior.response_json as unknown as { request: RequestResource },
          status: prior.status_code,
        };
      }
    }

    // §17.4 gates 3–4: shape checks the DB does not do at INSERT time.
    if (body.end_date < body.start_date) throw ApiError.of("INVALID_DATE_RANGE");
    if (body.end_date < todayIST()) throw ApiError.of("DATE_RANGE_IN_PAST");

    // §17.8 — a listing this Viewer cannot currently see reads as 404 (no
    // inventory oracle, §6.5); a listing paused mid-flight still yields the
    // trigger's 409 HOARDING_NOT_VISIBLE below.
    const { data: visible, error: visErr } = await supabase
      .from("hoardings")
      .select("id")
      .eq("id", body.hoarding_id)
      .maybeSingle();
    if (visErr) throw pgErrorToApiError(visErr);
    requireRow(visible, "HOARDING_NOT_FOUND");

    const { data: created, error } = await supabase
      .from("requests")
      .insert({
        hoarding_id: body.hoarding_id,
        viewer_id: user!.id,
        // NOT NULL; `validate_request_creation` (BEFORE INSERT) overwrites this
        // with the hoarding's real owner and sets `sla_deadline` (§17.7).
        publisher_id: user!.id,
        start_date: body.start_date,
        end_date: body.end_date,
        message: body.message ?? null,
      })
      .select("id")
      .single();

    if (error) {
      const mapped = pgErrorToApiError(error);
      if (mapped.code === "REQUEST_DUPLICATE_PENDING") {
        const { data: existing } = await supabase
          .from("requests")
          .select("id, start_date, end_date, status")
          .eq("hoarding_id", body.hoarding_id)
          .eq("viewer_id", user!.id)
          .eq("status", "REQUESTED")
          .maybeSingle();
        throw new ApiError(mapped.code, mapped.message, mapped.status, {
          existing_request_id: existing?.id,
          existing_start_date: existing?.start_date,
          existing_end_date: existing?.end_date,
          existing_status: existing?.status,
        });
      }
      throw mapped;
    }

    logResource(created.id);

    const [{ data: row, error: rowErr }, typeName] = await Promise.all([
      supabase
        .from("viewer_request_list")
        .select("*")
        .eq("id", created.id)
        .single(),
      typeNameMap(supabase),
    ]);
    if (rowErr) throw pgErrorToApiError(rowErr);

    const now = new Date();
    const request = toRequestResource(supabase, row, {
      role: "VIEWER",
      typeName,
      today: todayIST(now),
      now,
    });

    if (idemKey) {
      await supabase
        .from("api_idempotency_keys")
        .insert({
          key: idemKey,
          user_id: user!.id,
          endpoint: IDEMPOTENT_ENDPOINT,
          request_id: request.id,
          status_code: 201,
          response_json: { request } as unknown as Json,
        })
        .then(
          () => undefined,
          () => undefined, // a concurrent replay already stored it — fine
        );
    }

    return { data: { request }, status: 201 };
  },
});
