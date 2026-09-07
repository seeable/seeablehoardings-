import Image from "next/image";
import Link from "next/link";

/**
 * Auth shell — the gateway into SEEABLE. Split layout on `lg+`: a brand panel
 * (logo, tagline, portal glow) beside the auth card; the brand panel folds
 * away below `lg` and the wordmark moves above the card instead.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-0 flex min-h-dvh">
      <div className="border-border relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden border-r p-12 lg:flex xl:p-16">
        <div
          className="bg-gold-500/10 pointer-events-none absolute top-1/4 -left-32 h-96 w-96 rounded-full blur-3xl"
          aria-hidden
        />
        <div
          className="bg-gold-500/5 pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full blur-3xl"
          aria-hidden
        />

        <Link href="/" className="relative">
          <Image
            src="/logo-square.png"
            alt="SEEABLE Hoardings"
            width={220}
            height={165}
            className="h-32 w-auto xl:h-36"
            priority
          />
        </Link>

        <div className="relative">
          <p className="text-eyebrow text-gold-500 mb-3">
            Bigger visions, brighter places
          </p>
          <h1 className="font-display text-ink-900 text-4xl leading-[1.05] xl:text-5xl">
            SEE IT.
            <br />
            <span className="text-gold-500">STEP INTO IT.</span>
          </h1>
          <p className="text-ink-700 mt-5 max-w-sm text-sm leading-relaxed">
            Discover a smarter way to see, explore, and connect with the
            physical advertising world.
          </p>
        </div>

        <p className="text-eyebrow text-ink-500 relative">
          Outdoor advertising, reimagined.
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <Link href="/" className="mb-8 lg:hidden">
          <Image
            src="/logo-horizontal.png"
            alt="SEEABLE"
            width={160}
            height={53}
            className="h-10 w-auto"
            priority
          />
        </Link>
        <main className="w-full max-w-[420px]">{children}</main>
      </div>
    </div>
  );
}
