import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { Alert } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PublisherDashboard() {
  const user = await getSessionUser();
  const v = user?.verification;

  return (
    <section>
      <h1 className="text-h1 text-ink-900">Dashboard</h1>

      {v && v.publisher_verification_status !== "VERIFIED" && (
        <Alert tone="info" className="mt-4">
          Your account is{" "}
          {v.publisher_verification_status === "REJECTED"
            ? "not verified"
            : "pending verification"}
          . You can add hoardings as drafts, but can&apos;t publish them until
          an admin verifies you.{" "}
          <Link href="/publisher/verify" className="font-medium underline">
            Verification status
          </Link>
        </Alert>
      )}

      <p className="text-ink-500 mt-4">
        Inventory management arrives in Phase 5 / Phase 8. You&apos;re signed in
        as a publisher{v?.can_submit_listings ? " (verified)" : ""}.
      </p>
    </section>
  );
}
