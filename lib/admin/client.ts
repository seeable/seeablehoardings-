"use client";

/**
 * Browser calls for the Admin Platform (AD-01..05). Thin wrappers over the
 * `/api/v1/admin/*` facade — every one is `role = ADMIN` gated three ways
 * (facade → route → the DB function's own `is_admin()`).
 */
import { api } from "@/lib/api/client";
import type { PaginationMeta } from "@/lib/api/pagination";
import type {
  AdminActionRow,
  AdminDashboard,
  AdminKpis,
  AdminListingRow,
  AdminPublisherRow,
} from "@/lib/admin/types";

function qs(params: Record<string, string | string[] | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function getAdminDashboard(): Promise<AdminDashboard> {
  return api.get<AdminDashboard>("/api/v1/admin/dashboard").then((r) => r.data);
}

export function getAdminKpis(): Promise<AdminKpis> {
  return api.get<AdminKpis>("/api/v1/admin/kpis").then((r) => r.data);
}

export interface Page<T> {
  rows: T[];
  pagination?: PaginationMeta;
}

export function listAdminHoardings(params: {
  approval_status?: string[];
  publisher_id?: string;
  type?: string;
  site_intelligence_complete?: "true" | "false";
  page?: number;
  pageSize?: number;
}): Promise<Page<AdminListingRow>> {
  return api
    .get<{ hoardings: AdminListingRow[] }>(
      `/api/v1/admin/hoardings${qs({
        approval_status: params.approval_status,
        publisher_id: params.publisher_id,
        type: params.type,
        site_intelligence_complete: params.site_intelligence_complete,
        page: params.page?.toString(),
        pageSize: params.pageSize?.toString(),
      })}`,
    )
    .then((r) => ({ rows: r.data.hoardings, pagination: r.meta.pagination }));
}

export function listAdminPublishers(params: {
  verification_status?: string[];
  suspended?: "true" | "false";
  page?: number;
  pageSize?: number;
}): Promise<Page<AdminPublisherRow>> {
  return api
    .get<{ publishers: AdminPublisherRow[] }>(
      `/api/v1/admin/publishers${qs({
        verification_status: params.verification_status,
        suspended: params.suspended,
        page: params.page?.toString(),
        pageSize: params.pageSize?.toString(),
      })}`,
    )
    .then((r) => ({ rows: r.data.publishers, pagination: r.meta.pagination }));
}

export function getAdminPublisher(id: string): Promise<AdminPublisherRow> {
  return api
    .get<{ publisher: AdminPublisherRow }>(`/api/v1/admin/publishers/${id}`)
    .then((r) => r.data.publisher);
}

export function listAdminActions(params: {
  action_type?: string[];
  target_publisher_id?: string;
  target_hoarding_id?: string;
  page?: number;
  pageSize?: number;
}): Promise<Page<AdminActionRow>> {
  return api
    .get<{ actions: AdminActionRow[] }>(
      `/api/v1/admin/actions${qs({
        action_type: params.action_type,
        target_publisher_id: params.target_publisher_id,
        target_hoarding_id: params.target_hoarding_id,
        page: params.page?.toString(),
        pageSize: params.pageSize?.toString(),
      })}`,
    )
    .then((r) => ({ rows: r.data.actions, pagination: r.meta.pagination }));
}

// --- listing decisions ----------------------------------------------------

export const approveListing = (id: string) =>
  api.post(`/api/v1/admin/hoardings/${id}/approve`);

export const rejectListing = (id: string, reason: string) =>
  api.post(`/api/v1/admin/hoardings/${id}/reject`, { reason });

export const delistHoarding = (id: string, reason?: string) =>
  api.post(
    `/api/v1/admin/hoardings/${id}/delist`,
    reason ? { reason } : undefined,
  );

export const relistHoarding = (id: string) =>
  api.post(`/api/v1/admin/hoardings/${id}/relist`);

// --- publisher decisions ------------------------------------------------

export const verifyPublisher = (id: string) =>
  api.post(`/api/v1/admin/publishers/${id}/verify`);

export const rejectVerification = (id: string, reason?: string) =>
  api.post(
    `/api/v1/admin/publishers/${id}/reject-verification`,
    reason ? { reason } : undefined,
  );

export const suspendPublisher = (id: string, reason?: string) =>
  api.post(
    `/api/v1/admin/publishers/${id}/suspend`,
    reason ? { reason } : undefined,
  );

export const unsuspendPublisher = (id: string) =>
  api.post(`/api/v1/admin/publishers/${id}/unsuspend`);

export const getVerificationDocumentUrl = (id: string) =>
  api
    .get<{ url: string | null }>(
      `/api/v1/admin/publishers/${id}/verification-document`,
    )
    .then((r) => r.data.url);
