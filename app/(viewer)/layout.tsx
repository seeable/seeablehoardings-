import { requireRole } from "@/lib/auth/guard";
import { AppShell } from "@/components/nav/app-shell";

export const dynamic = "force-dynamic";

export default async function ViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("VIEWER");
  return (
    <AppShell role="VIEWER" name={user.full_name} email={user.email}>
      {children}
    </AppShell>
  );
}
