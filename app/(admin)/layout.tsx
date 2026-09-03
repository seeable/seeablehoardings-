import { requireRole } from "@/lib/auth/guard";
import { AppShell } from "@/components/nav/app-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("ADMIN");
  return (
    <AppShell role="ADMIN" name={user.full_name} email={user.email}>
      {children}
    </AppShell>
  );
}
