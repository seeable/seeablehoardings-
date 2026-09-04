import Link from "next/link";

/**
 * Shared shell for /terms and /privacy — Phase 11 (IMPLEMENTATION-PLAN.md
 * §Phase 11 "ToS / privacy / offline-settlement copy"). Plain content pages,
 * no app chrome, matching the landing page's unauthenticated styling.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-gold-700 text-sm font-medium">
        ← SEEABLE
      </Link>
      <h1 className="font-display text-ink-900 mt-4 text-3xl">{title}</h1>
      <p className="text-ink-500 mt-1 text-xs">Last updated {updated}</p>
      <div className="text-ink-700 [&_h2]:text-ink-900 [&_h2]:font-display mt-8 space-y-4 text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:first:mt-0 [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2">
        {children}
      </div>
    </main>
  );
}
