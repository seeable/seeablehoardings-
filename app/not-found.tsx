import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Image
        src="/logo-square.png"
        alt="SEEABLE"
        width={64}
        height={48}
        className="h-12 w-auto opacity-80"
      />
      <p className="text-eyebrow text-gold-500">404</p>
      <h1 className="font-heading text-ink-900 text-2xl">
        Looks like this view isn&rsquo;t visible.
      </h1>
      <p className="text-ink-700">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
      </p>
      <div>
        <Link
          href="/"
          className="bg-gold-500 hover:bg-gold-700 text-gold-800 rounded-md px-4 py-2 text-sm font-semibold transition-colors"
        >
          Return to SEEABLE
        </Link>
      </div>
    </main>
  );
}
