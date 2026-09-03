/**
 * Browser API client for the `/api/v1` facade — IMPLEMENTATION-PLAN.md §Phase 3.
 * Unwraps the envelope, surfaces `error.code`, carries `request_id` for bug
 * reports, and fires a `seeable:unauthorized` event on 401 (AuthProvider
 * listens and re-checks the session).
 */
import type { PaginationMeta } from "@/lib/api/pagination";

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown>,
    readonly requestId: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface ApiResult<T> {
  data: T;
  meta: { pagination?: PaginationMeta } & Record<string, unknown>;
  requestId: string;
}

const UNAUTHORIZED_EVENT = "seeable:unauthorized";

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const res = await fetch(path.startsWith("/") ? path : `/api/v1/${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  let envelope: unknown;
  try {
    envelope = await res.json();
  } catch {
    throw new ApiClientError(
      "INTERNAL_ERROR",
      "The server returned an unexpected response.",
      res.status,
      {},
      res.headers.get("x-request-id") ?? "unknown",
    );
  }

  const body = envelope as
    | { success: true; data: T; meta: ApiResult<T>["meta"]; request_id: string }
    | {
        success: false;
        error: {
          code: string;
          message: string;
          details: Record<string, unknown>;
        };
        request_id: string;
      };

  if (body.success) {
    return {
      data: body.data,
      meta: body.meta ?? {},
      requestId: body.request_id,
    };
  }

  if (res.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }

  throw new ApiClientError(
    body.error.code,
    body.error.message,
    res.status,
    body.error.details ?? {},
    body.request_id,
  );
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: "GET" }),
  post: <T>(path: string, json?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: "POST",
      body: json ? JSON.stringify(json) : undefined,
    }),
  patch: <T>(path: string, json?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: "PATCH",
      body: json ? JSON.stringify(json) : undefined,
    }),
  delete: <T>(path: string, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: "DELETE" }),
};

export { UNAUTHORIZED_EVENT };
