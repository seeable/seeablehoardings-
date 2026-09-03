import type { Metadata } from "next";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { HoardingTable } from "@/components/inventory/hoarding-table";
import { VerificationBanner } from "@/components/publisher/verification-banner";
import type { VerificationStatus } from "@/lib/publisher/types";

export const metadata: Metadata = { title: "My hoardings" };
export const dynamic = "force-dynamic";

export default async function MyHoardingsPage() {
  const user = await getSessionUser();
  const status = user?.verification.publisher_verification_status as
    | VerificationStatus
    | null
    | undefined;

  return (
    <>
      {status && status !== "VERIFIED" && (
        <div className="mb-4">
          <VerificationBanner status={status} />
        </div>
      )}
      <Suspense fallback={null}>
        <HoardingTable />
      </Suspense>
    </>
  );
}
