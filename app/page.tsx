import Link from "next/link";
import { SkeletonProbe } from "@/components/skeleton-probe";

/**
 * Phase 0 walking skeleton. Confirms the app builds and deploys with the four
 * heavy client dependencies imported (IMPLEMENTATION-PLAN.md §Phase 0 / RISK-1):
 * @supabase/supabase-js, maplibre-gl, react-hook-form, zod.
 * Replaced by AUTH-01 (marketing landing) in Phase 2.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-gold-700 text-[11px] font-semibold tracking-[0.04em] uppercase">
          Phase 0 · Project Foundation
        </p>
        <h1 className="font-display text-ink-900 mt-2 text-4xl">
          SEEABLE Hoardings
        </h1>
        <p className="text-ink-700 mt-3 max-w-md">
          Bengaluru&rsquo;s outdoor advertising, in one place. This is the
          walking skeleton — the app builds, deploys, and loads the client
          dependency set.
        </p>
      </div>

      <SkeletonProbe />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/api/health"
          className="border-border bg-surface-1 text-ink-900 hover:bg-surface-2 rounded-md border px-3 py-2"
        >
          /api/health
        </Link>
        <a
          href="https://github.com"
          className="border-border bg-surface-1 text-ink-900 hover:bg-surface-2 rounded-md border px-3 py-2"
        >
          Repository
        </a>
      </div>
    </main>
  );
}
