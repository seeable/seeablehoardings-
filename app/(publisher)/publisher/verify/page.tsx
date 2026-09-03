import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** PB-08 stub — full identity/business verification flow is Phase 8 / Phase 9. */
export default async function PublisherVerifyPage() {
  const user = await getSessionUser();
  const status =
    user?.verification.publisher_verification_status ?? "UNVERIFIED";

  const copy: Record<string, string> = {
    UNVERIFIED: "We haven't received your verification details yet.",
    VERIFIED: "Your account is verified — you can publish listings.",
    REJECTED: "Your verification was not approved. Contact support to retry.",
  };

  return (
    <section>
      <h1 className="font-heading text-ink-900 text-2xl">Verification</h1>
      <p className="text-ink-700 mt-2">Status: {status}</p>
      <p className="text-ink-500 mt-1">{copy[status]}</p>
      <p className="text-ink-500 mt-4 text-sm">
        The verification submission form (PB-08) is built in Phase 8.
      </p>
    </section>
  );
}
