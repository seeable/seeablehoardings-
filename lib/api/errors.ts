/**
 * SEEABLE API error taxonomy — api-specification.md §8.3 / §8.4.
 *
 * `code` is the stable, machine-readable string clients branch on. It never
 * changes meaning within `v1`; new codes may be added (additive).
 *
 * Phase 0 defines the shape + the core codes. The SEEABLE-specific business
 * codes (REQUEST_DATE_CONFLICT, HOARDING_INCOMPLETE_ATTRIBUTES, …) are added
 * by the phase that introduces the rule they carry.
 */

export const ErrorCode = {
  // --- Core -----------------------------------------------------------------
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
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
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** HTTP status for each error code (api-specification.md §8.3). */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  BAD_REQUEST: 400,
  AUTH_REQUIRED: 401,
  AUTH_TOKEN_INVALID: 401,
  AUTH_TOKEN_EXPIRED: 401,
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

  static of(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    return new ApiError(code, message, ERROR_STATUS[code], details ?? {});
  }
}
