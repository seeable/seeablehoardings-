"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-eyebrow text-gold-500">Error</p>
      <h1 className="font-heading text-ink-900 text-2xl">
        Something went wrong.
      </h1>
      <p className="text-ink-700">
        We hit an unexpected error. Try again — if it keeps happening, contact
        SEEABLE support{error.digest ? ` and quote ${error.digest}` : ""}.
      </p>
      <div>
        <button
          onClick={reset}
          className="bg-gold-500 hover:bg-gold-700 text-gold-800 rounded-md px-4 py-2 text-sm font-semibold transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
