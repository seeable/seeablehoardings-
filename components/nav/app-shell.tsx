import { LeftRail } from "@/components/nav/left-rail";
import { BottomTabs } from "@/components/nav/bottom-tabs";
import { TopBar } from "@/components/nav/top-bar";
import type { Role } from "@/components/nav/nav-config";

/**
 * The authenticated chrome for a role — docs/01 §4, docs/02 §10.5.
 *   left rail (lg+, all roles) · top bar (bell + account) · bottom tabs (Viewer, < lg)
 * Server component: it just arranges the pieces around `children`; the
 * interactive parts (rail active state, bell, menus) are their own client islands.
 */
export function AppShell({
  role,
  name,
  email,
  children,
}: {
  role: Role;
  name: string | null;
  email: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <LeftRail role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar role={role} name={name} email={email} />
        <main
          className={
            "mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8 " +
            (role === "VIEWER" ? "pb-24 lg:pb-8" : "")
          }
        >
          {children}
        </main>
      </div>
      {role === "VIEWER" && <BottomTabs />}
    </div>
  );
}
