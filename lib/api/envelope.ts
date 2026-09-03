import { NextResponse } from "next/server";
import { ulid } from "ulid";
import { ApiError } from "@/lib/api/errors";

/**
 * Standard API response envelope — api-specification.md §7.
 * Used on every `/api/v1/*` endpoint (the two carve-outs are `/api/health`
 * and, in v1.0 of the plan, `/api/jobs/*` — the latter is replaced by pg_cron).
 */

export type Meta = Record<string, unknown>;

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta: Meta;
  request_id: string;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  request_id: string;
}

/** Correlation ID — also returned as the `X-Request-Id` header (§35). */
export function newRequestId(): string {
  return `req_${ulid()}`;
}

export function ok<T>(
  data: T,
  init?: { meta?: Meta; status?: number; requestId?: string },
): NextResponse<SuccessEnvelope<T>> {
  const request_id = init?.requestId ?? newRequestId();
  return NextResponse.json(
    { success: true, data, meta: init?.meta ?? {}, request_id },
    { status: init?.status ?? 200, headers: { "X-Request-Id": request_id } },
  );
}

export function fail(
  error: ApiError,
  init?: { requestId?: string },
): NextResponse<ErrorEnvelope> {
  const request_id = init?.requestId ?? newRequestId();
  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      request_id,
    },
    { status: error.status, headers: { "X-Request-Id": request_id } },
  );
}

/**
 * Wrap a route handler so any thrown `ApiError` becomes an error envelope and
 * any unexpected throw becomes a generic `500` (never leaking internals — §33.8).
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    const requestId = newRequestId();
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return fail(err, { requestId });
      }
      console.error(`[${requestId}] unhandled route error`, err);
      return fail(
        new ApiError(
          "INTERNAL_ERROR",
          "Something went wrong. Please try again.",
          500,
        ),
        { requestId },
      );
    }
  };
}
