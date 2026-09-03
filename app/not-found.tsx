import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
      <p className="text-ink-500 text-[11px] font-semibold tracking-[0.04em] uppercase">
        404
      </p>
      <h1 className="font-heading text-ink-900 text-2xl">Page not found</h1>
      <p className="text-ink-700">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
      </p>
      <div>
        <Link
          href="/"
          className="bg-ink-900 hover:bg-ink-800 rounded-md px-4 py-2 text-sm font-semibold text-white"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
