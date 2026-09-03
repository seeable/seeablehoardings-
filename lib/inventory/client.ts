"use client";

/**
 * Browser calls for the Inventory endpoints. Thin wrappers over `api`
 * (lib/api/client) — envelope unwrap + typed returns. Media upload is
 * multipart, so it bypasses `api` and posts the FormData directly.
 */
import { api, ApiClientError } from "@/lib/api/client";
import { watermarkImage } from "@/lib/inventory/watermark";
import type {
  HoardingOwnerView,
  HoardingTypeView,
  MediaAsset,
} from "@/lib/inventory/types";
import type { CreateHoardingInput, UpdateHoardingInput } from "@/lib/inventory/schema";

export async function listHoardingTypes(): Promise<HoardingTypeView[]> {
  const r = await api.get<{ hoarding_types: HoardingTypeView[] }>(
    "/api/v1/hoarding-types",
  );
  return r.data.hoarding_types;
}

export async function createHoarding(
  input: CreateHoardingInput,
): Promise<HoardingOwnerView> {
  const r = await api.post<{ hoarding: HoardingOwnerView }>(
    "/api/v1/hoardings",
    input,
  );
  return r.data.hoarding;
}

export async function updateHoarding(
  id: string,
  patch: UpdateHoardingInput,
): Promise<HoardingOwnerView> {
  const r = await api.patch<{ hoarding: HoardingOwnerView }>(
    `/api/v1/hoardings/${id}`,
    patch,
  );
  return r.data.hoarding;
}

export async function getHoarding(id: string): Promise<HoardingOwnerView> {
  const r = await api.get<{ hoarding: HoardingOwnerView }>(
    `/api/v1/hoardings/${id}`,
  );
  return r.data.hoarding;
}

export async function submitHoarding(id: string): Promise<HoardingOwnerView> {
  const r = await api.post<{ hoarding: HoardingOwnerView }>(
    `/api/v1/hoardings/${id}/submit`,
  );
  return r.data.hoarding;
}

export async function deleteHoarding(id: string): Promise<void> {
  await api.delete(`/api/v1/hoardings/${id}`);
}

export async function listMedia(hoardingId: string): Promise<MediaAsset[]> {
  const r = await api.get<{ media: MediaAsset[] }>(
    `/api/v1/hoardings/${hoardingId}/media`,
  );
  return r.data.media;
}

export async function deleteMedia(
  hoardingId: string,
  mediaId: string,
): Promise<void> {
  await api.delete(`/api/v1/hoardings/${hoardingId}/media/${mediaId}`);
}

export async function setPrimaryMedia(
  hoardingId: string,
  mediaId: string,
): Promise<void> {
  await api.patch(`/api/v1/hoardings/${hoardingId}/media/${mediaId}`, {
    is_primary: true,
  });
}

/** Watermark in the browser, then upload the derivative as multipart. */
export async function uploadMedia(
  hoardingId: string,
  file: File,
  opts: { isPrimary?: boolean } = {},
): Promise<MediaAsset> {
  const { blob } = await watermarkImage(file);
  const form = new FormData();
  form.append("file", blob, `${file.name.replace(/\.[^.]+$/, "")}.jpg`);
  if (opts.isPrimary) form.append("is_primary", "true");

  const res = await fetch(`/api/v1/hoardings/${hoardingId}/media`, {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
  });
  const envelope = await res.json().catch(() => null);
  if (!res.ok || !envelope?.success) {
    throw new ApiClientError(
      envelope?.error?.code ?? "INTERNAL_ERROR",
      envelope?.error?.message ?? "Upload failed.",
      res.status,
      envelope?.error?.details ?? {},
      envelope?.request_id ?? res.headers.get("x-request-id") ?? "unknown",
    );
  }
  return envelope.data as MediaAsset;
}

export interface AvailabilityView {
  hoarding_id: string;
  window: { from: string; to: string };
  is_listed: boolean;
  unavailable_ranges: {
    start_date: string;
    end_date: string;
    reason: "BOOKED" | "BLOCKED";
  }[];
  blocks?: { id: string; start_date: string; end_date: string; reason: string | null }[];
  bookings?: {
    start_date: string;
    end_date: string;
    status: string;
    viewer_name: string | null;
  }[];
}

export async function getAvailability(
  hoardingId: string,
  window?: { from?: string; to?: string },
): Promise<AvailabilityView> {
  const qs = new URLSearchParams();
  if (window?.from) qs.set("from", window.from);
  if (window?.to) qs.set("to", window.to);
  const suffix = qs.toString() ? `?${qs}` : "";
  const r = await api.get<AvailabilityView>(
    `/api/v1/hoardings/${hoardingId}/availability${suffix}`,
  );
  return r.data;
}

export async function addBlock(
  hoardingId: string,
  range: { start_date: string; end_date: string; reason?: string },
): Promise<void> {
  await api.post(`/api/v1/hoardings/${hoardingId}/availability/blocks`, range);
}

export async function removeBlock(
  hoardingId: string,
  blockId: string,
): Promise<void> {
  await api.delete(
    `/api/v1/hoardings/${hoardingId}/availability/blocks/${blockId}`,
  );
}
