/**
 * PostgreSQL / PostgREST error  ->  SEEABLE ApiError.
 * api-specification.md §8.5 · database-design.md §41 · Decision D7.
 *
 * Order of resolution:
 *   1. `DETAIL='SEEABLE_CODE=<CODE>'` attached by a SECURITY DEFINER function
 *      (the D7 contract) — the function tells us exactly which outcome it is.
 *   2. SQLSTATE + constraint-name fallback for errors Postgres raises directly
 *      (exclusion / unique / FK / check violations, insufficient privilege).
 *   3. Anything else -> INTERNAL_ERROR (safe, generic; the caller logs the raw
 *      error against the request_id).
 *
 * Isomorphic on purpose: the same mapping is used by the /api/v1 facade AND by
 * direct `supabase.from()` / `.rpc()` calls in client components.
 */
import { ApiError, ERROR_STATUS, type ErrorCode } from "@/lib/api/errors";

/** The subset of a supabase-js / PostgREST error we read. */
export interface PgErrorLike {
  code?: string | null; // SQLSTATE ('23505') or PostgREST code ('PGRST116')
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

const SEEABLE_CODE_RE = /SEEABLE_CODE=([A-Z0-9_]+)/;

/** Safe, one-sentence messages for the business codes the DB layer raises. */
const MESSAGE: Partial<Record<string, string>> = {
  DATE_RANGE_IN_PAST: "The requested dates are in the past.",
  HOARDING_NOT_FOUND: "That listing could not be found.",
  HOARDING_NOT_VISIBLE: "This listing is not currently available.",
  HOARDING_INVALID_STATE:
    "That action is not allowed from the listing's current state.",
  HOARDING_INCOMPLETE_ATTRIBUTES:
    "This listing is missing required fields for its hoarding type.",
  HOARDING_MISSING_CORE_FIELDS:
    "Price and location are required before submission.",
  HOARDING_MISSING_MEDIA: "At least one photo is required before submission.",
  HOARDING_MEDIA_NOT_WATERMARKED:
    "All photos must finish processing before this listing can be submitted.",
  HOARDING_EDIT_FROZEN:
    "Core details can't be edited while a request is pending on this listing.",
  HOARDING_ALREADY_DELISTED: "This listing is already delisted.",
  HOARDING_NOT_DELISTED: "This listing is not currently delisted.",
  HOARDING_HAS_REQUEST_HISTORY:
    "This listing has request history and can't be deleted — delist it instead.",
  PUBLISHER_NOT_VERIFIED:
    "Your publisher account must be verified before you can do this.",
  PUBLISHER_SUSPENDED: "Your publisher account is suspended.",
  PUBLISHER_NOT_FOUND: "That publisher could not be found.",
  REQUEST_NOT_FOUND: "That request could not be found.",
  REQUEST_DATE_CONFLICT:
    "Those dates are no longer available — please choose different dates.",
  REQUEST_DUPLICATE_PENDING:
    "You already have a pending request on this listing.",
  REQUEST_STATE_CONFLICT:
    "This request is no longer in a state that allows that action.",
  REQUEST_COMPLETE_TOO_EARLY:
    "A request can't be completed before its start date.",
  MEDIA_NOT_FOUND: "That media file could not be found.",
  ADMIN_ONLY: "This action requires an administrator.",
  FORBIDDEN_NOT_OWNER: "You don't have permission to act on this resource.",
  FORBIDDEN: "You don't have permission to do that.",
  VALIDATION_ERROR: "One or more fields are invalid.",
  RESOURCE_NOT_FOUND: "That resource could not be found.",
  SERVICE_UNAVAILABLE:
    "The service is temporarily unavailable. Please try again.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
};

/** SQLSTATE -> code, for errors Postgres raises without a SEEABLE_CODE tag. */
const SQLSTATE: Record<string, string> = {
  "23P01": "REQUEST_DATE_CONFLICT", // exclusion_violation on requests_no_overlapping_confirmed
  "23505": "REQUEST_DUPLICATE_PENDING", // unique_violation — refined by constraint name below
  "23503": "HOARDING_HAS_REQUEST_HISTORY", // foreign_key_violation on DELETE FROM hoardings
  "23514": "VALIDATION_ERROR", // check_violation (price, lat/lng, date order, reason-required)
  "42501": "FORBIDDEN", // insufficient_privilege / RAISE 42501
  P0002: "RESOURCE_NOT_FOUND", // no_data_found / RAISE P0002
  "08000": "SERVICE_UNAVAILABLE",
  "08006": "SERVICE_UNAVAILABLE",
  "08003": "SERVICE_UNAVAILABLE",
  "57014": "SERVICE_UNAVAILABLE", // query_canceled / statement timeout
  PGRST116: "RESOURCE_NOT_FOUND", // PostgREST: zero rows where one was required
};

const msg = (code: string): string => MESSAGE[code] ?? MESSAGE.INTERNAL_ERROR!;

const statusFor = (code: string): number =>
  ERROR_STATUS[code as ErrorCode] ?? 500;

/**
 * Map a raw DB/PostgREST error to an ApiError. Never throws.
 * `blob` is `message + ' ' + details + ' ' + hint` — used for constraint-name
 * disambiguation only.
 */
export function pgErrorToApiError(
  err: PgErrorLike | null | undefined,
): ApiError {
  if (!err) return ApiError.of("INTERNAL_ERROR", msg("INTERNAL_ERROR"));

  const blob = `${err.message ?? ""} ${err.details ?? ""} ${err.hint ?? ""}`;

  // 1. D7 tag wins.
  const tagged =
    SEEABLE_CODE_RE.exec(err.details ?? "") ?? SEEABLE_CODE_RE.exec(blob);
  if (tagged) {
    const code = tagged[1];
    // 42501 with a SEEABLE_CODE still carries the right code (ADMIN_ONLY /
    // FORBIDDEN_NOT_OWNER); trust the tag.
    return new ApiError(code, msg(code), statusFor(code));
  }

  // 2. SQLSTATE fallback.
  const sqlstate = err.code ?? "";

  if (sqlstate === "23505") {
    if (/one_pending_per_viewer_hoarding/.test(blob)) {
      return new ApiError(
        "REQUEST_DUPLICATE_PENDING",
        msg("REQUEST_DUPLICATE_PENDING"),
        statusFor("REQUEST_DUPLICATE_PENDING"),
      );
    }
    return new ApiError("VALIDATION_ERROR", msg("VALIDATION_ERROR"), 422);
  }

  if (sqlstate === "42501") {
    // A bare 42501 with no tag: an Admin function refused -> ADMIN_ONLY,
    // otherwise a not-owner refusal. We can't always tell; FORBIDDEN is safe.
    const code = /admin/i.test(blob) ? "ADMIN_ONLY" : "FORBIDDEN";
    return new ApiError(code, msg(code), 403);
  }

  const mapped = SQLSTATE[sqlstate];
  if (mapped) return new ApiError(mapped, msg(mapped), statusFor(mapped));

  // 3. Unknown — generic.
  return ApiError.of("INTERNAL_ERROR", msg("INTERNAL_ERROR"));
}

/** Extract just the SEEABLE_CODE string from an error, or null. */
export function seeableCodeOf(
  err: PgErrorLike | null | undefined,
): string | null {
  if (!err) return null;
  const m =
    SEEABLE_CODE_RE.exec(err.details ?? "") ??
    SEEABLE_CODE_RE.exec(`${err.message ?? ""} ${err.hint ?? ""}`);
  return m ? m[1] : null;
}
