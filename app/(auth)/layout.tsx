import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-0 flex min-h-dvh flex-col items-center px-4 py-10">
      <Link
        href="/"
        className="font-display text-ink-900 mb-8 text-xl tracking-wide"
      >
        SEEABLE
      </Link>
      <main className="w-full max-w-[400px]">{children}</main>
    </div>
  );
}
