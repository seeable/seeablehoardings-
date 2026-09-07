import Image from "next/image";
import Link from "next/link";
import { getSessionUser, homePathForRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const btnPrimary =
  "inline-flex h-11 items-center justify-center rounded-md bg-gold-500 px-6 text-sm font-semibold text-gold-800 hover:bg-gold-700 hover:shadow-gold-glow transition-[background-color,box-shadow]";
const btnSecondary =
  "inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface-1 px-6 text-sm font-medium text-ink-900 hover:bg-surface-2";

/**
 * AUTH-01 — Landing / marketing entry (docs/05 §AUTH-01).
 * Dark SEEABLE brand system end-to-end, logo + tagline + one CTA pair.
 */
export default async function Landing() {
  const user = await getSessionUser();

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div
        className="bg-gold-500/10 pointer-events-none absolute top-1/4 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl"
        aria-hidden
      />
      <Image
        src="/logo-square.png"
        alt="SEEABLE Hoardings"
        width={120}
        height={90}
        className="relative h-20 w-auto"
        priority
      />
      <p className="text-eyebrow text-gold-500 relative mt-6">
        Bigger visions, brighter places
      </p>
      <h1 className="font-display text-ink-900 relative mt-3 text-4xl leading-[1.05] sm:text-5xl">
        SEE IT.
        <br />
        <span className="text-gold-500">STEP INTO IT.</span>
      </h1>
      <p className="text-ink-700 relative mt-4 max-w-xl">
        Discover, compare, and request hoardings, unipoles, and street furniture
        from verified Publishers across Bengaluru.
      </p>

      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
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
