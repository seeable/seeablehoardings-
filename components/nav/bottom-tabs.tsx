"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, VIEWER_NAV } from "@/components/nav/nav-config";
import { cn } from "@/lib/utils";

/**
 * Viewer mobile bottom tab bar — docs/02 §10.5. 56px, `surface-1` + top border,
 * active tab = `gold-500` icon + label, inactive = `ink-500`. Three items
 * (Discover / My requests / Account) — no Shortlist (D9). `lg`+ uses the rail.
 */
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="border-border bg-surface-1 fixed inset-x-0 bottom-0 z-30 flex h-14 border-t lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {VIEWER_NAV.map(({ label, href, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]",
              active ? "text-gold-500 font-semibold" : "text-ink-500",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
