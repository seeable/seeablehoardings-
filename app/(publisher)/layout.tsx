import { requireRole } from "@/lib/auth/guard";
import { AppShell } from "@/components/nav/app-shell";

export const dynamic = "force-dynamic";

export default async function PublisherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("PUBLISHER");
  return (
    <AppShell role="PUBLISHER" name={user.full_name} email={user.email}>
      {children}
    </AppShell>
  );
}
