"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, navForRole, type Role } from "@/components/nav/nav-config";
import { cn } from "@/lib/utils";

/**
 * Desktop left rail — docs/02 §10.5. 240px fixed, `surface-1`, 1px right border.
 * Active item = `gold-500` 3px left-edge bar + `surface-2` bg + bold `ink-900`.
 * Used by all three roles on `lg+` (Viewer falls back to bottom tabs below that).
 */
export function LeftRail({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navForRole(role);

  return (
    <nav
      aria-label="Primary"
      className="border-border bg-surface-1 hidden w-60 shrink-0 flex-col border-r lg:flex"
    >
      <Link
        href="/"
        className="text-display text-ink-900 flex h-16 items-center px-5 text-xl tracking-wide"
      >
        SEEABLE
      </Link>
      <ul className="flex flex-col gap-0.5 px-2 py-2">
        {items.map(({ label, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                  active
                    ? "bg-surface-2 text-ink-900 font-semibold"
                    : "text-ink-700 hover:bg-surface-2 hover:text-ink-900",
                )}
              >
                {active && (
                  <span className="bg-gold-500 absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r" />
                )}
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
