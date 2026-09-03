import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { buildPublisherProfile } from "@/lib/publisher/projection";
import { VerificationForm } from "@/components/publisher/verification-form";

export const metadata: Metadata = { title: "Verification" };
export const dynamic = "force-dynamic";

export default async function PublisherVerifyPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "PUBLISHER") redirect("/login?next=/publisher/verify");

  const supabase = await createClient();
  const profile = await buildPublisherProfile(supabase, user.id);
  if (!profile) redirect("/publisher/dashboard");

  return (
    <section>
      <h1 className="text-h1 text-ink-900 mb-4">Verify your business</h1>
      <VerificationForm initial={profile} />
    </section>
  );
}
