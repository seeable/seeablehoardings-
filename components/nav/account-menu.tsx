"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { Role } from "@/components/nav/nav-config";
import { cn } from "@/lib/utils";

/**
 * Account/avatar menu in the top bar (SH-01 entry point). Initials avatar,
 * name, and a small dropdown: Account settings (Viewer/Publisher only — Admin
 * has no SH-01) and Sign out (POSTs to the session route).
 */
export function AccountMenu({
  name,
  email,
  role,
}: {
  name: string | null;
  email: string | null;
  role: Role;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const label = name || email || "Account";
  const initials = (name || email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="text-ink-700 hover:bg-surface-2 flex items-center gap-2 rounded-full py-1 pr-2 pl-1"
      >
        <span className="bg-surface-2 text-ink-700 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold">
          {initials || "?"}
        </span>
        <span className="hidden max-w-[10rem] truncate text-sm sm:block">
          {label}
        </span>
        <ChevronDown className="hidden h-4 w-4 sm:block" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="border-border bg-surface-1 absolute right-0 z-40 mt-1 w-48 rounded-md border p-1 shadow-md"
        >
          <div className="text-ink-500 truncate px-3 py-2 text-xs">{email}</div>
          {role !== "ADMIN" && (
            <Link
              href="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemCls}
            >
              Account settings
            </Link>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem" className={cn(itemCls, "w-full text-left")}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const itemCls =
  "block rounded px-3 py-2 text-sm text-ink-900 hover:bg-surface-2";
