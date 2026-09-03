import { Monitor } from "lucide-react";

/**
 * Admin is desktop-only (docs/05 header, docs/00 §3.3). A narrow-viewport visit
 * gets this plain notice rather than a broken responsive attempt. Pure CSS —
 * the real screen renders for `lg+`, this for everything below.
 */
export function DesktopOnly({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-col items-center gap-3 px-6 py-20 text-center lg:hidden">
        <Monitor className="text-ink-500 h-8 w-8" aria-hidden />
        <h1 className="text-h3 text-ink-900">SEEABLE Admin is built for desktop</h1>
        <p className="text-ink-500 max-w-xs text-sm">
          Open this page on a larger screen to review publishers and listings.
        </p>
      </div>
      <div className="hidden lg:block">{children}</div>
    </>
  );
}
