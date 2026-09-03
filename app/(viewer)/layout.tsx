import { requireRole } from "@/lib/auth/guard";
import { RoleBar } from "@/components/auth/role-bar";

export const dynamic = "force-dynamic";

export default async function ViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("VIEWER");
  return (
    <div className="bg-surface-0 min-h-dvh">
      <RoleBar user={user} />
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </div>
  );
}
