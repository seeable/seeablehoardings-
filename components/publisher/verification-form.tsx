"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-provider";
import { submitVerification } from "@/lib/publisher/client";
import { BUSINESS_TYPES, type PublisherProfile } from "@/lib/publisher/types";
import { DOC_MAX_BYTES } from "@/lib/publisher/verification";
import { ApiClientError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";

/**
 * PB-08 Publisher Verification. Form for the not-started / rejected states;
 * a status block for pending / verified. "1–2 business days" is illustrative
 * copy, not a committed SLA (docs/04 PB-08 UX ASSUMPTION).
 */
export function VerificationForm({ initial }: { initial: PublisherProfile }) {
  const router = useRouter();
  const toast = useToast();
  const { refresh } = useAuth();
  const [profile, setProfile] = React.useState(initial);
  const [editing, setEditing] = React.useState(
    initial.verification_status === "UNVERIFIED" ||
      initial.verification_status === "REJECTED",
  );

  const [businessName, setBusinessName] = React.useState(
    initial.business_name ?? "",
  );
  const [businessType, setBusinessType] = React.useState(
    initial.business_type ?? "",
  );
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const status = profile.verification_status;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!businessName.trim()) return setError("Enter your registered business name.");
    if (!file) return setError("Attach a verification document.");
    if (file.size > DOC_MAX_BYTES)
      return setError("That file is larger than 8 MB.");

    setBusy(true);
    try {
      const next = await submitVerification({
        business_name: businessName.trim(),
        business_type: businessType || undefined,
        document: file,
      });
      setProfile(next);
      setEditing(false);
      await refresh();
      toast.success("Verification submitted — we'll review it shortly.");
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Couldn't submit. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!editing && status === "VERIFIED") {
    return (
      <div className="border-border bg-surface-1 space-y-2 rounded-lg border p-4">
        <p className="text-success-700 flex items-center gap-2 font-semibold">
          <span className="bg-success-50 flex h-7 w-7 items-center justify-center rounded-full">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
          Verified
        </p>
        <p className="text-ink-500 text-sm">
          {profile.verified_at
            ? `Verified on ${formatDate(profile.verified_at)}.`
            : "Your business is verified."}{" "}
          Your listings can go live once approved.
        </p>
      </div>
    );
  }

  if (!editing && status === "PENDING") {
    return (
      <div className="border-border bg-surface-1 space-y-2 rounded-lg border p-4">
        <p className="text-ink-900 font-semibold">
          Verification submitted — under review
        </p>
        <p className="text-ink-500 text-sm">
          {profile.verification_submitted_at
            ? `Submitted on ${formatDate(profile.verification_submitted_at)}. `
            : ""}
          This usually takes 1–2 business days. You can keep building listings as
          drafts in the meantime.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4">
      {status === "REJECTED" && profile.verification_rejection_reason && (
        <Alert tone="warning">
          Your previous submission wasn&apos;t approved:{" "}
          {profile.verification_rejection_reason}
        </Alert>
      )}

      <p className="text-ink-500 text-sm">
        SEEABLE verifies Publishers to build trust with advertisers. This usually
        takes 1–2 business days.
      </p>

      <Field label="Registered business name" htmlFor="v-name" required>
        <Input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          maxLength={200}
          autoComplete="organization"
        />
      </Field>

      <Field label="Business type" htmlFor="v-type">
        <Select
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          placeholder="Select a type"
        >
          {BUSINESS_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-ink-800 text-sm font-medium">
          Verification document <span className="text-danger-700">*</span>
        </span>
        <label className="border-border hover:bg-surface-2 flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-3 text-sm">
          {file ? (
            <>
              <FileText className="text-ink-500 h-5 w-5 shrink-0" aria-hidden />
              <span className="text-ink-900 truncate">{file.name}</span>
            </>
          ) : (
            <>
              <UploadCloud className="text-ink-500 h-5 w-5 shrink-0" aria-hidden />
              <span className="text-ink-500">
                Business registration or ID proof — PDF or image, up to 8 MB
              </span>
            </>
          )}
          <input
            type="file"
            accept="application/pdf,image/*"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex gap-2">
        <Button type="submit" loading={busy}>
          {status === "REJECTED" ? "Resubmit" : "Submit for verification"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/publisher/dashboard")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
