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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-ink-900 text-2xl">
        Something went wrong
      </h1>
      <p className="text-ink-700">
        We hit an unexpected error. Try again — if it keeps happening, contact
        SEEABLE support{error.digest ? ` and quote ${error.digest}` : ""}.
      </p>
      <div>
        <button
          onClick={reset}
          className="bg-ink-900 hover:bg-ink-800 rounded-md px-4 py-2 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
