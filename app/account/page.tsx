import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth/session";
import { AccountSettings } from "@/components/publisher/account-settings";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getSessionUser();
  return <AccountSettings role={user?.role ?? "VIEWER"} />;
}
