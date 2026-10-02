import Link from 'next/link';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-cream">
      <p className="font-display text-sm tracking-[0.3em] text-cream-dim">404</p>
      <h1 className="font-display text-3xl">This page isn't here</h1>
      <p className="max-w-prose text-cream-dim">
        Whatever you were looking for isn't at this address. The front door is still where it always was.
      </p>
      <Link href="/" className="mt-4 border-b border-brass pb-1 text-brass transition hover:text-halo-warm">
        Back to The Hub
      </Link>
    </main>
  );
}
