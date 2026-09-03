"use client";
/**
 * Browser calls for the Request Engine endpoints — thin wrappers over `api`
 * (lib/api/client). `createRequest` sends an `Idempotency-Key` so a retried
 * submit after a lost response cannot create a second request (§17.1 / §31).
 */
import { api } from "@/lib/api/client";
import type {
  RequestAction,
  RequestHistoryEntry,
  RequestResource,
} from "@/lib/requests/types";
import type { PaginationMeta } from "@/lib/api/pagination";

export interface RequestListResult {
  requests: RequestResource[];
  pagination: PaginationMeta;
  counts_by_status: Record<string, number>;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function createRequest(input: {
  hoarding_id: string;
  start_date: string;
  end_date: string;
  message?: string;
  idempotencyKey?: string;
}): Promise<RequestResource> {
  const { idempotencyKey, ...body } = input;
  const r = await api.post<{ request: RequestResource }>(
    "/api/v1/requests",
    body,
    { headers: { "Idempotency-Key": idempotencyKey ?? uuid() } },
  );
  return r.data.request;
}

export async function listMyRequests(
  statuses: string[] = [],
): Promise<RequestListResult> {
  const p = new URLSearchParams({ pageSize: "100" });
  for (const s of statuses) p.append("status", s);
  const r = await api.get<{ requests: RequestResource[] }>(
    `/api/v1/requests/me?${p}`,
  );
  return {
    requests: r.data.requests,
    pagination: r.meta.pagination as PaginationMeta,
    counts_by_status: (r.meta.counts_by_status as Record<string, number>) ?? {},
  };
}

export async function listIncomingRequests(
  statuses: string[] = [],
): Promise<RequestListResult> {
  const p = new URLSearchParams({ pageSize: "100" });
  for (const s of statuses) p.append("status", s);
  const r = await api.get<{ requests: RequestResource[] }>(
    `/api/v1/publishers/me/requests?${p}`,
  );
  return {
    requests: r.data.requests,
    pagination: r.meta.pagination as PaginationMeta,
    counts_by_status: (r.meta.counts_by_status as Record<string, number>) ?? {},
  };
}

export async function getRequest(id: string): Promise<RequestResource> {
  const r = await api.get<{ request: RequestResource }>(
    `/api/v1/requests/${id}`,
  );
  return r.data.request;
}

export async function getRequestHistory(
  id: string,
): Promise<RequestHistoryEntry[]> {
  const r = await api.get<{ history: RequestHistoryEntry[] }>(
    `/api/v1/requests/${id}/history`,
  );
  return r.data.history;
}

export async function actOnRequest(
  id: string,
  action: RequestAction,
  extra: { reason?: string; amount_agreed?: number } = {},
): Promise<RequestResource> {
  const r = await api.patch<{ request: RequestResource }>(
    `/api/v1/requests/${id}`,
    { action, ...extra },
  );
  return r.data.request;
}
