/**
 * PostgreSQL / PostgREST error  ->  SEEABLE ApiError.
 * api-specification.md §8.5 · database-design.md §41 · Decision D7.
 *
 * Order of resolution:
 *   1. `DETAIL='SEEABLE_CODE=<CODE>'` attached by a SECURITY DEFINER function
 *      (the D7 contract) — the function tells us exactly which outcome it is.
 *   2. SQLSTATE + constraint-name fallback for errors Postgres raises directly
 *      (exclusion / unique / FK / check violations, insufficient privilege,
 *      PostgREST's zero-rows code).
 *   3. Anything else -> INTERNAL_ERROR (safe, generic; the caller logs the raw
 *      error against the request_id).
 *
 * Isomorphic on purpose: the same mapping is used by the /api/v1 facade AND by
 * direct `supabase.from()` / `.rpc()` calls in client components.
 */
import { ApiError, resolveError } from "@/lib/api/errors";

/** The subset of a supabase-js / PostgREST error we read. */
export interface PgErrorLike {
  code?: string | null; // SQLSTATE ('23505') or PostgREST code ('PGRST116')
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

const SEEABLE_CODE_RE = /SEEABLE_CODE=([A-Z0-9_]+)/;

/** SQLSTATE / PostgREST code -> SEEABLE code, when there is no SEEABLE_CODE tag. */
const SQLSTATE: Record<string, string> = {
  "23P01": "REQUEST_DATE_CONFLICT", // exclusion_violation on requests_no_overlapping_confirmed
  "23505": "REQUEST_DUPLICATE_PENDING", // unique_violation — refined by constraint name below
  "23503": "HOARDING_HAS_REQUEST_HISTORY", // foreign_key_violation on DELETE FROM hoardings
  "23514": "VALIDATION_ERROR", // check_violation (price, lat/lng, date order, reason-required)
  "42501": "FORBIDDEN", // insufficient_privilege / RAISE 42501
  P0002: "RESOURCE_NOT_FOUND", // no_data_found / RAISE P0002
  "08000": "SERVICE_UNAVAILABLE",
  "08003": "SERVICE_UNAVAILABLE",
  "08006": "SERVICE_UNAVAILABLE",
  "57014": "SERVICE_UNAVAILABLE", // query_canceled / statement timeout
  PGRST116: "RESOURCE_NOT_FOUND", // .single() found zero (or many) rows — §6.5: 404
  PGRST301: "AUTH_REQUIRED", // JWT expired / invalid at PostgREST
};

const err = (code: string, details: Record<string, unknown> = {}): ApiError => {
  const { status, message } = resolveError(code);
  return new ApiError(code, message, status, details);
};

/** Map a raw DB/PostgREST error to an ApiError. Never throws. */
export function pgErrorToApiError(e: PgErrorLike | null | undefined): ApiError {
  if (!e) return err("INTERNAL_ERROR");

  const blob = `${e.message ?? ""} ${e.details ?? ""} ${e.hint ?? ""}`;

  // 1. D7 tag wins — the function told us exactly which outcome.
  const tagged =
    SEEABLE_CODE_RE.exec(e.details ?? "") ?? SEEABLE_CODE_RE.exec(blob);
  if (tagged) return err(tagged[1]);

  // 2. SQLSTATE / PostgREST-code fallback.
  const state = e.code ?? "";

  if (state === "23505") {
    return /one_pending_per_viewer_hoarding/.test(blob)
      ? err("REQUEST_DUPLICATE_PENDING")
      : err("VALIDATION_ERROR");
  }
  if (state === "42501") {
    // A bare 42501 with no tag: an Admin function refused -> ADMIN_ONLY,
    // otherwise a not-owner refusal. FORBIDDEN is the safe generic.
    return err(/admin/i.test(blob) ? "ADMIN_ONLY" : "FORBIDDEN");
  }

  const mapped = SQLSTATE[state];
  if (mapped) return err(mapped);

  // 3. Unknown — generic 500.
  return err("INTERNAL_ERROR");
}

/** Extract just the SEEABLE_CODE string from an error, or null. */
export function seeableCodeOf(
  e: PgErrorLike | null | undefined,
): string | null {
  if (!e) return null;
  const m =
    SEEABLE_CODE_RE.exec(e.details ?? "") ??
    SEEABLE_CODE_RE.exec(`${e.message ?? ""} ${e.hint ?? ""}`);
  return m ? m[1] : null;
}

/** Does this look like a supabase-js / PostgREST error object? */
export function isPgError(x: unknown): x is PgErrorLike {
  return (
    typeof x === "object" &&
    x !== null &&
    ("code" in x || "details" in x) &&
    "message" in x
  );
}
