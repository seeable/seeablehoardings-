"use client";

import Link from "next/link";
import Image from "next/image";
import { NotificationBell } from "@/components/nav/notification-bell";
import { AccountMenu } from "@/components/nav/account-menu";
import { MobileNav } from "@/components/nav/mobile-nav";
import type { Role } from "@/components/nav/nav-config";

/**
 * Top bar — the right-side controls (bell + account) on every authenticated
 * screen, plus the logo and a menu button on `< lg` where the left rail is
 * hidden. Publisher gets the drawer menu; Viewer uses bottom tabs; Admin is
 * desktop-only so it just shows the rail-less logo.
 */
export function TopBar({
  role,
  name,
  email,
}: {
  role: Role;
  name: string | null;
  email: string | null;
}) {
  return (
    <header className="border-border bg-surface-1/95 sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-4 backdrop-blur">
      <div className="flex items-center gap-2 lg:hidden">
        {role === "PUBLISHER" && <MobileNav role={role} />}
        <Link href="/" className="flex items-center">
          <Image
            src="/logo-horizontal.png"
            alt="SEEABLE"
            width={100}
            height={50}
            className="h-8 w-auto"
            priority
          />
        </Link>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {role !== "ADMIN" && <NotificationBell role={role} />}
        <AccountMenu name={name} email={email} role={role} />
      </div>
    </header>
  );
}
