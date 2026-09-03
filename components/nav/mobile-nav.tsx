"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { isActive, navForRole, type Role } from "@/components/nav/nav-config";
import { cn } from "@/lib/utils";

/**
 * Publisher mobile nav — docs/07 §23. Publisher has more items than fit a bottom
 * bar and needs mobile access for Request responses, so `< lg` gets a menu
 * button that opens the nav as a drawer (Viewer uses bottom tabs; Admin is
 * desktop-only).
 */
export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const items = navForRole(role);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="text-ink-700 hover:bg-surface-2 flex h-9 w-9 items-center justify-center rounded-md lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Menu" width="sm">
        <ul className="p-2">
          {items.map(({ label, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                    active
                      ? "bg-surface-2 text-ink-900 font-semibold"
                      : "text-ink-700 hover:bg-surface-2",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </Drawer>
    </>
  );
}
