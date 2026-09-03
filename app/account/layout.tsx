import { redirect } from "next/navigation";
import { getSessionUser, homePathForRole } from "@/lib/auth/session";
import { AppShell } from "@/components/nav/app-shell";
import type { Role } from "@/components/nav/nav-config";

export const dynamic = "force-dynamic";

/**
 * SH-01 lives at a single `/account` URL shared by Viewer and Publisher
 * (docs/01 §5 — "role-variant content"). Admin has no SH-01, so an Admin who
 * lands here is bounced to their console.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  if (user.role === "ADMIN") redirect(homePathForRole(user.role));

  return (
    <AppShell
      role={user.role as Role}
      name={user.full_name}
      email={user.email}
    >
      {children}
    </AppShell>
  );
}
