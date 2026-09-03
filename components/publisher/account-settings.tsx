"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ShieldAlert, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-provider";
import {
  getProfile,
  getPublisher,
  updateProfile,
  updatePublisher,
} from "@/lib/publisher/client";
import { ApiClientError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import type { PublisherProfile, VerificationStatus } from "@/lib/publisher/types";
import { cn } from "@/lib/utils";

type Panel = "profile" | "security" | "verification";

/**
 * SH-01 Account & Profile Settings (docs/05 SH-01). Shared shell, role-variant
 * content — the Publisher adds Business Name + a Verification status block; the
 * Viewer gets Full Name and no verification section.
 */
export function AccountSettings({ role }: { role: string }) {
  const isPublisher = role === "PUBLISHER";
  const [panel, setPanel] = React.useState<Panel>("profile");
  const [data, setData] = React.useState<PublisherProfile | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (isPublisher ? getPublisher() : getProfile().then(toPublisherShape))
      .then((p) => !cancelled && setData(p as PublisherProfile))
      .catch(
        (e: unknown) =>
          !cancelled &&
          setError(
            e instanceof ApiClientError ? e.message : "Couldn't load your account.",
          ),
      );
    return () => {
      cancelled = true;
    };
  }, [isPublisher]);

  const nav: { key: Panel; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "security", label: "Security" },
    ...(isPublisher
      ? [{ key: "verification" as const, label: "Verification" }]
      : []),
  ];

  return (
    <section>
      <h1 className="text-h1 text-ink-900 mb-4">Account</h1>

      {error ? (
        <Alert tone="danger">{error}</Alert>
      ) : (
        <div className="grid gap-6 md:grid-cols-[180px_1fr]">
          <nav className="flex gap-1 md:flex-col" aria-label="Account settings">
            {nav.map((n) => (
              <button
                key={n.key}
                type="button"
                onClick={() => setPanel(n.key)}
                className={cn(
                  "rounded-md px-3 py-2 text-left text-sm",
                  panel === n.key
                    ? "bg-surface-2 text-ink-900 font-medium"
                    : "text-ink-700 hover:bg-surface-2",
                )}
              >
                {n.label}
              </button>
            ))}
          </nav>

          <div className="min-w-0">
            {!data ? (
              <div className="max-w-md space-y-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : panel === "profile" ? (
              <ProfilePanel data={data} isPublisher={isPublisher} onSaved={setData} />
            ) : panel === "security" ? (
              <SecurityPanel />
            ) : (
              <VerificationPanel status={data.verification_status} data={data} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function toPublisherShape(p: {
  id: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
}): PublisherProfile {
  return {
    ...p,
    business_name: null,
    business_type: null,
    verification_status: "UNVERIFIED",
    verified_at: null,
    verification_submitted_at: null,
    verification_rejection_reason: null,
    suspended: false,
    suspended_at: null,
    suspension_reason: null,
    can_submit_listings: false,
  };
}

function ProfilePanel({
  data,
  isPublisher,
  onSaved,
}: {
  data: PublisherProfile;
  isPublisher: boolean;
  onSaved: (p: PublisherProfile) => void;
}) {
  const toast = useToast();
  const { refresh } = useAuth();
  const [fullName, setFullName] = React.useState(data.full_name ?? "");
  const [businessName, setBusinessName] = React.useState(data.business_name ?? "");
  const [phone, setPhone] = React.useState(data.phone ?? "");
  const [email, setEmail] = React.useState(data.email ?? "");
  const [city, setCity] = React.useState(data.city ?? "");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const patch = {
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      city: city.trim() || null,
      ...(isPublisher ? { business_name: businessName.trim() || null } : {}),
    };
    try {
      const next = isPublisher
        ? await updatePublisher(patch)
        : toPublisherShape(await updateProfile(patch));
      onSaved(next as PublisherProfile);
      await refresh();
      toast.success("Saved.");
    } catch (e2) {
      setErr(e2 instanceof ApiClientError ? e2.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-md space-y-4">
      {isPublisher ? (
        <Field label="Business name" htmlFor="a-biz">
          <Input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            maxLength={200}
          />
        </Field>
      ) : (
        <Field label="Full name" htmlFor="a-name">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={120}
          />
        </Field>
      )}
      <Field label="Contact phone" htmlFor="a-phone">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
      </Field>
      <Field label="Contact email" htmlFor="a-email">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
        />
      </Field>
      <Field label="City" htmlFor="a-city">
        <Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />
      </Field>

      {err && <Alert tone="danger">{err}</Alert>}
      <Button type="submit" loading={busy}>
        Save changes
      </Button>
    </form>
  );
}

function SecurityPanel() {
  return (
    <div className="max-w-md space-y-3">
      <p className="text-ink-700 text-sm">
        Your password is managed through SEEABLE&apos;s sign-in. Use the reset
        link to change it.
      </p>
      <Link
        href="/forgot-password"
        className="bg-ink-900 text-surface-1 inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
      >
        Reset password
      </Link>
    </div>
  );
}

function VerificationPanel({
  status,
  data,
}: {
  status: VerificationStatus;
  data: PublisherProfile;
}) {
  return (
    <div className="max-w-md space-y-3">
      {status === "VERIFIED" ? (
        <p className="text-success-700 flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-5 w-5" />
          Verified{data.verified_at ? ` on ${formatDate(data.verified_at)}` : ""}
        </p>
      ) : status === "PENDING" ? (
        <p className="text-ink-700 flex items-center gap-2 text-sm">
          <Check className="text-ink-500 h-5 w-5" />
          Verification submitted — under review.
        </p>
      ) : (
        <p className="text-warning-700 flex items-center gap-2 text-sm">
          <ShieldAlert className="h-5 w-5" />
          {status === "REJECTED"
            ? "Your verification wasn't approved."
            : "Your business isn't verified yet."}
        </p>
      )}
      {status === "REJECTED" && data.verification_rejection_reason && (
        <Alert tone="warning">{data.verification_rejection_reason}</Alert>
      )}
      <Link
        href="/publisher/verify"
        className="text-gold-800 inline-block text-sm font-medium hover:underline"
      >
        {status === "VERIFIED" ? "View details" : "Go to verification"}
      </Link>
    </div>
  );
}
