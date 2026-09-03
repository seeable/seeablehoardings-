"use client";
/** Browser calls for the Publisher Platform endpoints. */
import { api, ApiClientError } from "@/lib/api/client";
import type {
  ProfileResource,
  PublisherProfile,
  PublisherSummary,
} from "@/lib/publisher/types";

export async function getProfile(): Promise<ProfileResource> {
  const r = await api.get<{ profile: ProfileResource }>("/api/v1/profiles/me");
  return r.data.profile;
}

export async function updateProfile(
  patch: Partial<Pick<ProfileResource, "full_name" | "phone" | "email" | "city">>,
): Promise<ProfileResource> {
  const r = await api.patch<{ profile: ProfileResource }>(
    "/api/v1/profiles/me",
    patch,
  );
  return r.data.profile;
}

export async function getPublisher(): Promise<PublisherProfile> {
  const r = await api.get<{ publisher: PublisherProfile }>(
    "/api/v1/publishers/me",
  );
  return r.data.publisher;
}

export async function updatePublisher(
  patch: Partial<
    Pick<PublisherProfile, "full_name" | "phone" | "email" | "city" | "business_name">
  >,
): Promise<PublisherProfile> {
  const r = await api.patch<{ publisher: PublisherProfile }>(
    "/api/v1/publishers/me",
    patch,
  );
  return r.data.publisher;
}

export async function getPublisherSummary(): Promise<PublisherSummary> {
  const r = await api.get<{ summary: PublisherSummary }>(
    "/api/v1/publishers/me/summary",
  );
  return r.data.summary;
}

/** PB-08 — multipart, bypasses `api` (like the media upload). */
export async function submitVerification(input: {
  business_name: string;
  business_type?: string;
  document: File;
}): Promise<PublisherProfile> {
  const form = new FormData();
  form.append("business_name", input.business_name);
  if (input.business_type) form.append("business_type", input.business_type);
  form.append("document", input.document, input.document.name);

  const res = await fetch("/api/v1/publishers/me/verification", {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
  });
  const envelope = await res.json().catch(() => null);
  if (!res.ok || !envelope?.success) {
    throw new ApiClientError(
      envelope?.error?.code ?? "INTERNAL_ERROR",
      envelope?.error?.message ?? "Submission failed.",
      res.status,
      envelope?.error?.details ?? {},
      envelope?.request_id ?? res.headers.get("x-request-id") ?? "unknown",
    );
  }
  return envelope.data.publisher as PublisherProfile;
}
