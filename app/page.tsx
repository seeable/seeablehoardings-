import Image from "next/image";
import Link from "next/link";
import { getSessionUser, homePathForRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const btnPrimary =
  "inline-flex h-11 items-center justify-center rounded-md bg-ink-900 px-6 text-sm font-medium text-surface-1 hover:bg-ink-800";
const btnSecondary =
  "inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface-1 px-6 text-sm font-medium text-ink-900 hover:bg-surface-2";

/**
 * AUTH-01 — Landing / marketing entry (docs/05 §AUTH-01).
 * Light system end-to-end, logo + hero, one CTA pair.
 */
export default async function Landing() {
  const user = await getSessionUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-6 text-center">
      <Image
        src="/logo-square.png"
        alt="SEEABLE"
        width={120}
        height={90}
        className="h-20 w-auto"
        priority
      />
      <h1 className="font-display text-ink-900 mt-4 text-4xl leading-tight sm:text-5xl">
        Bengaluru&apos;s outdoor advertising, in one place.
      </h1>
      <p className="text-ink-700 mt-4 max-w-xl">
        Discover, compare, and request hoardings, unipoles, and street furniture
        from verified Publishers across the city.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {user ? (
          <Link href={homePathForRole(user.role)} className={btnPrimary}>
            Go to your dashboard
          </Link>
        ) : (
          <>
            <Link href="/login" className={btnSecondary}>
              Log in
            </Link>
            <Link href="/signup" className={btnPrimary}>
              Sign up
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
