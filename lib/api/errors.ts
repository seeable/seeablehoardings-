/**
 * SEEABLE API error taxonomy — api-specification.md §8.3 / §8.4.
 *
 * `code` is the stable, machine-readable string clients branch on. It never
 * changes meaning within `v1`; new codes may be added (additive).
 *
 * `ERROR_STATUS` and `ERROR_MESSAGE` are the two lookups the facade and the
 * DB-error mapper share. `ERROR_MESSAGE` is a SAFE default — one sentence, no
 * SQL/PII/identifiers, displayable verbatim (§8.1). A handler may pass a more
 * specific message, but never a less safe one.
 */

export const ErrorCode = {
  // --- Core (§8.3) --------------------------------------------------------
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_IDENTITY_IN_USE: "AUTH_IDENTITY_IN_USE",
  AUTH_ROLE_NOT_SELF_ASSIGNABLE: "AUTH_ROLE_NOT_SELF_ASSIGNABLE",
  AUTH_OTP_INVALID: "AUTH_OTP_INVALID",
  AUTH_OTP_EXPIRED: "AUTH_OTP_EXPIRED",
  AUTH_OTP_DISABLED: "AUTH_OTP_DISABLED",
  AUTH_ACCOUNT_SUSPENDED: "AUTH_ACCOUNT_SUSPENDED",
  AUTH_VERIFICATION_REQUIRED: "AUTH_VERIFICATION_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  FORBIDDEN_ROLE: "FORBIDDEN_ROLE",
  FORBIDDEN_NOT_OWNER: "FORBIDDEN_NOT_OWNER",
  ADMIN_ONLY: "ADMIN_ONLY",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  NOT_ACCEPTABLE: "NOT_ACCEPTABLE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",

  // --- Pagination / filtering / input (§8.4) ----------------------------
  INVALID_PAGINATION: "INVALID_PAGINATION",
  INVALID_FILTER: "INVALID_FILTER",
  INVALID_DATE_RANGE: "INVALID_DATE_RANGE",
  DATE_RANGE_IN_PAST: "DATE_RANGE_IN_PAST",
  GEO_PARAMS_INCOMPLETE: "GEO_PARAMS_INCOMPLETE",

  // --- Inventory / listing (§8.4) --------------------------------------
  HOARDING_NOT_FOUND: "HOARDING_NOT_FOUND",
  HOARDING_NOT_VISIBLE: "HOARDING_NOT_VISIBLE",
  HOARDING_NOT_APPROVED: "HOARDING_NOT_APPROVED",
  HOARDING_PAUSED: "HOARDING_PAUSED",
  HOARDING_DELISTED: "HOARDING_DELISTED",
  HOARDING_INVALID_STATE: "HOARDING_INVALID_STATE",
  HOARDING_INCOMPLETE_ATTRIBUTES: "HOARDING_INCOMPLETE_ATTRIBUTES",
  HOARDING_MISSING_CORE_FIELDS: "HOARDING_MISSING_CORE_FIELDS",
  HOARDING_MISSING_MEDIA: "HOARDING_MISSING_MEDIA",
  HOARDING_MEDIA_NOT_WATERMARKED: "HOARDING_MEDIA_NOT_WATERMARKED",
  HOARDING_EDIT_FROZEN: "HOARDING_EDIT_FROZEN",
  HOARDING_ALREADY_DELISTED: "HOARDING_ALREADY_DELISTED",
  HOARDING_NOT_DELISTED: "HOARDING_NOT_DELISTED",
  HOARDING_HAS_REQUEST_HISTORY: "HOARDING_HAS_REQUEST_HISTORY",
  HOARDING_TYPE_UNKNOWN: "HOARDING_TYPE_UNKNOWN",
  HOARDING_TYPE_NOT_LISTABLE: "HOARDING_TYPE_NOT_LISTABLE",

  // --- Publisher trust state (§8.4) -----------------------------------
  PUBLISHER_NOT_VERIFIED: "PUBLISHER_NOT_VERIFIED",
  PUBLISHER_SUSPENDED: "PUBLISHER_SUSPENDED",
  PUBLISHER_NOT_FOUND: "PUBLISHER_NOT_FOUND",
  PUBLISHER_VERIFICATION_STATE_CONFLICT:
    "PUBLISHER_VERIFICATION_STATE_CONFLICT",

  // --- Request Engine (§8.4) -----------------------------------------
  REQUEST_NOT_FOUND: "REQUEST_NOT_FOUND",
  REQUEST_DATE_CONFLICT: "REQUEST_DATE_CONFLICT",
  REQUEST_DUPLICATE_PENDING: "REQUEST_DUPLICATE_PENDING",
  REQUEST_STATE_CONFLICT: "REQUEST_STATE_CONFLICT",
  REQUEST_ACTION_INVALID: "REQUEST_ACTION_INVALID",
  REQUEST_COMPLETE_TOO_EARLY: "REQUEST_COMPLETE_TOO_EARLY",
  REQUEST_AMOUNT_NOT_SETTABLE: "REQUEST_AMOUNT_NOT_SETTABLE",
  REQUEST_CANCEL_UNSUPPORTED: "REQUEST_CANCEL_UNSUPPORTED",

  // --- Media / Content Protection (§8.4) ----------------------------
  MEDIA_NOT_FOUND: "MEDIA_NOT_FOUND",
  MEDIA_TYPE_UNSUPPORTED: "MEDIA_TYPE_UNSUPPORTED",
  MEDIA_TOO_LARGE: "MEDIA_TOO_LARGE",
  MEDIA_DIMENSIONS_INVALID: "MEDIA_DIMENSIONS_INVALID",
  MEDIA_PROCESSING: "MEDIA_PROCESSING",
  MEDIA_PROCESSING_FAILED: "MEDIA_PROCESSING_FAILED",
  MEDIA_ORIGINAL_UNAVAILABLE: "MEDIA_ORIGINAL_UNAVAILABLE",
  MEDIA_LIMIT_EXCEEDED: "MEDIA_LIMIT_EXCEEDED",

  // --- Idempotency & jobs (§8.4) -----------------------------------
  IDEMPOTENCY_KEY_INVALID: "IDEMPOTENCY_KEY_INVALID",
  IDEMPOTENCY_KEY_CONFLICT: "IDEMPOTENCY_KEY_CONFLICT",
  IDEMPOTENCY_REQUEST_IN_FLIGHT: "IDEMPOTENCY_REQUEST_IN_FLIGHT",
  JOB_UNAUTHORIZED: "JOB_UNAUTHORIZED",
  JOB_ALREADY_RUNNING: "JOB_ALREADY_RUNNING",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** HTTP status for each error code (api-specification.md §8.3 / §8.4). */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  BAD_REQUEST: 400,
  AUTH_REQUIRED: 401,
  AUTH_TOKEN_INVALID: 401,
  AUTH_TOKEN_EXPIRED: 401,
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_IDENTITY_IN_USE: 409,
  AUTH_ROLE_NOT_SELF_ASSIGNABLE: 403,
  AUTH_OTP_INVALID: 401,
  AUTH_OTP_EXPIRED: 410,
  AUTH_OTP_DISABLED: 501,
  AUTH_ACCOUNT_SUSPENDED: 403,
  AUTH_VERIFICATION_REQUIRED: 403,
  FORBIDDEN: 403,
  FORBIDDEN_ROLE: 403,
  FORBIDDEN_NOT_OWNER: 403,
  ADMIN_ONLY: 403,
  RESOURCE_NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  STORAGE_UNAVAILABLE: 503,

  INVALID_PAGINATION: 400,
  INVALID_FILTER: 400,
  INVALID_DATE_RANGE: 422,
  DATE_RANGE_IN_PAST: 422,
  GEO_PARAMS_INCOMPLETE: 400,

  HOARDING_NOT_FOUND: 404,
  HOARDING_NOT_VISIBLE: 409,
  HOARDING_NOT_APPROVED: 409,
  HOARDING_PAUSED: 409,
  HOARDING_DELISTED: 409,
  HOARDING_INVALID_STATE: 409,
  HOARDING_INCOMPLETE_ATTRIBUTES: 409,
  HOARDING_MISSING_CORE_FIELDS: 409,
  HOARDING_MISSING_MEDIA: 409,
  HOARDING_MEDIA_NOT_WATERMARKED: 409,
  HOARDING_EDIT_FROZEN: 409,
  HOARDING_ALREADY_DELISTED: 409,
  HOARDING_NOT_DELISTED: 409,
  HOARDING_HAS_REQUEST_HISTORY: 409,
  HOARDING_TYPE_UNKNOWN: 422,
  HOARDING_TYPE_NOT_LISTABLE: 422,

  PUBLISHER_NOT_VERIFIED: 403,
  PUBLISHER_SUSPENDED: 403,
  PUBLISHER_NOT_FOUND: 404,
  PUBLISHER_VERIFICATION_STATE_CONFLICT: 409,

  REQUEST_NOT_FOUND: 404,
  REQUEST_DATE_CONFLICT: 409,
  REQUEST_DUPLICATE_PENDING: 409,
  REQUEST_STATE_CONFLICT: 409,
  REQUEST_ACTION_INVALID: 422,
  REQUEST_COMPLETE_TOO_EARLY: 409,
  REQUEST_AMOUNT_NOT_SETTABLE: 409,
  REQUEST_CANCEL_UNSUPPORTED: 501,

  MEDIA_NOT_FOUND: 404,
  MEDIA_TYPE_UNSUPPORTED: 415,
  MEDIA_TOO_LARGE: 413,
  MEDIA_DIMENSIONS_INVALID: 422,
  MEDIA_PROCESSING: 409,
  MEDIA_PROCESSING_FAILED: 409,
  MEDIA_ORIGINAL_UNAVAILABLE: 404,
  MEDIA_LIMIT_EXCEEDED: 409,

  IDEMPOTENCY_KEY_INVALID: 400,
  IDEMPOTENCY_KEY_CONFLICT: 409,
  IDEMPOTENCY_REQUEST_IN_FLIGHT: 409,
  JOB_UNAUTHORIZED: 401,
  JOB_ALREADY_RUNNING: 409,
};

/** Safe, displayable-verbatim default message for each code (§8.1). */
export const ERROR_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "One or more fields are invalid.",
  BAD_REQUEST: "The request could not be understood.",
  AUTH_REQUIRED: "You are not signed in.",
  AUTH_TOKEN_INVALID: "Your session is invalid. Please sign in again.",
  AUTH_TOKEN_EXPIRED: "Your session has expired. Please sign in again.",
  AUTH_INVALID_CREDENTIALS: "Incorrect email or password.",
  AUTH_IDENTITY_IN_USE: "An account with this email already exists.",
  AUTH_ROLE_NOT_SELF_ASSIGNABLE: "That role can't be chosen at sign-up.",
  AUTH_OTP_INVALID: "That code is incorrect.",
  AUTH_OTP_EXPIRED: "That code has expired. Request a new one.",
  AUTH_OTP_DISABLED: "One-time-code sign-in is not available.",
  AUTH_ACCOUNT_SUSPENDED: "This account is suspended.",
  AUTH_VERIFICATION_REQUIRED: "Your account must be verified to do this.",
  FORBIDDEN: "You don't have permission to do that.",
  FORBIDDEN_ROLE: "Your account type can't use this feature.",
  FORBIDDEN_NOT_OWNER: "You don't have permission to act on this resource.",
  ADMIN_ONLY: "This action requires an administrator.",
  RESOURCE_NOT_FOUND: "That resource could not be found.",
  METHOD_NOT_ALLOWED: "That method is not allowed here.",
  NOT_ACCEPTABLE: "This endpoint only returns JSON.",
  UNSUPPORTED_MEDIA_TYPE: "That content type is not supported.",
  PAYLOAD_TOO_LARGE: "That upload is too large.",
  RATE_LIMITED: "Too many requests. Please slow down.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
  SERVICE_UNAVAILABLE:
    "The service is temporarily unavailable. Please try again.",
  STORAGE_UNAVAILABLE:
    "File storage is temporarily unavailable. Please try again.",

  INVALID_PAGINATION:
    "page must be ≥ 1 and pageSize must be between 1 and 100.",
  INVALID_FILTER: "One or more filters are not recognised.",
  INVALID_DATE_RANGE: "The end date must be on or after the start date.",
  DATE_RANGE_IN_PAST: "The requested dates are in the past.",
  GEO_PARAMS_INCOMPLETE:
    "Provide latitude, longitude and maxDistance together.",

  HOARDING_NOT_FOUND: "That listing could not be found.",
  HOARDING_NOT_VISIBLE: "This listing is not currently available.",
  HOARDING_NOT_APPROVED: "This listing has not been approved.",
  HOARDING_PAUSED: "This listing is paused.",
  HOARDING_DELISTED: "This listing has been delisted.",
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
  HOARDING_TYPE_UNKNOWN: "That hoarding type is not recognised.",
  HOARDING_TYPE_NOT_LISTABLE: "That hoarding type can't be listed yet.",

  PUBLISHER_NOT_VERIFIED:
    "Your publisher account must be verified before you can do this.",
  PUBLISHER_SUSPENDED: "Your publisher account is suspended.",
  PUBLISHER_NOT_FOUND: "That publisher could not be found.",
  PUBLISHER_VERIFICATION_STATE_CONFLICT:
    "That verification action is not allowed from the current status.",

  REQUEST_NOT_FOUND: "That request could not be found.",
  REQUEST_DATE_CONFLICT:
    "Those dates are no longer available — please choose different dates.",
  REQUEST_DUPLICATE_PENDING:
    "You already have a pending request on this listing.",
  REQUEST_STATE_CONFLICT:
    "This request is no longer in a state that allows that action.",
  REQUEST_ACTION_INVALID: "That action is not valid for this request.",
  REQUEST_COMPLETE_TOO_EARLY:
    "A request can't be completed before its start date.",
  REQUEST_AMOUNT_NOT_SETTABLE:
    "The agreed amount can't be set on this request yet.",
  REQUEST_CANCEL_UNSUPPORTED: "Withdrawing a request is not available.",

  MEDIA_NOT_FOUND: "That media file could not be found.",
  MEDIA_TYPE_UNSUPPORTED: "That file type is not supported.",
  MEDIA_TOO_LARGE: "That file is too large.",
  MEDIA_DIMENSIONS_INVALID:
    "That image's dimensions are outside the allowed range.",
  MEDIA_PROCESSING: "This file is still processing. Try again shortly.",
  MEDIA_PROCESSING_FAILED: "This file could not be processed.",
  MEDIA_ORIGINAL_UNAVAILABLE: "No original is available for this file.",
  MEDIA_LIMIT_EXCEEDED: "This listing already has the maximum number of files.",

  IDEMPOTENCY_KEY_INVALID: "The idempotency key is malformed.",
  IDEMPOTENCY_KEY_CONFLICT:
    "This idempotency key was used with a different request.",
  IDEMPOTENCY_REQUEST_IN_FLIGHT:
    "The original request is still being processed.",
  JOB_UNAUTHORIZED: "Not authorised to run this job.",
  JOB_ALREADY_RUNNING: "This job is already running.",
};

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | string,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Build from a known code, using its default status + message. */
  static of(
    code: ErrorCode,
    message?: string,
    details?: Record<string, unknown>,
  ) {
    return new ApiError(
      code,
      message ?? ERROR_MESSAGE[code] ?? ERROR_MESSAGE.INTERNAL_ERROR,
      ERROR_STATUS[code] ?? 500,
      details ?? {},
    );
  }
}

/** Status + safe message for any code string (unknown -> 500 / generic). */
export function resolveError(code: string): {
  status: number;
  message: string;
} {
  return {
    status: ERROR_STATUS[code as ErrorCode] ?? 500,
    message: ERROR_MESSAGE[code as ErrorCode] ?? ERROR_MESSAGE.INTERNAL_ERROR,
  };
}
