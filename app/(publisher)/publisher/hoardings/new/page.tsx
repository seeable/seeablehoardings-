import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { listTypeViews } from "@/lib/inventory/server";
import { HoardingWizard } from "@/components/inventory/hoarding-wizard";
import { VerificationBanner } from "@/components/publisher/verification-banner";
import type { VerificationStatus } from "@/lib/publisher/types";

export const metadata: Metadata = { title: "Add a hoarding" };
export const dynamic = "force-dynamic";

export default async function NewHoardingPage() {
  const supabase = await createClient();
  const [types, user] = await Promise.all([
    listTypeViews(supabase),
    getSessionUser(),
  ]);
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
      <HoardingWizard types={types} />
    </>
  );
}
