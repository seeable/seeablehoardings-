import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Placeholder top bar for the authenticated shells. Phase 4 replaces this with
 * the real per-role navigation (docs/01 §4, docs/02 §10).
 */
export function RoleBar({ user }: { user: SessionUser }) {
  const label =
    user.role === "PUBLISHER"
      ? "Publisher"
      : user.role === "ADMIN"
        ? "Admin"
        : "Advertiser";

  return (
    <header className="border-border bg-surface-1 flex items-center justify-between border-b px-4 py-3">
      <Link href="/" className="font-display text-ink-900 tracking-wide">
        SEEABLE
      </Link>
      <div className="text-ink-500 flex items-center gap-3 text-sm">
        <span>
          {user.full_name ?? user.email} · {label}
        </span>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="border-border text-ink-700 hover:bg-surface-2 rounded-md border px-3 py-1"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
