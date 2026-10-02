import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms & Conditions' };

const SECTIONS = [
  'Booking & payment',
  'Cancellations & refunds',
  'Acceptable use of the space',
  'Access & opening hours',
  'Liability',
  'Changes to these terms',
];

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-8 bg-ink px-6 py-16 text-cream">
      <Link href="/" className="text-sm text-cream-dim transition hover:text-cream">
        ← The Hub at Lloyds Wharf
      </Link>
      <div>
        <h1 className="font-display text-3xl">Terms & Conditions</h1>
        <p className="mt-4 rounded-sm border border-brass/40 bg-ink-2 px-4 py-3 text-sm text-cream-dim">
          This page is a placeholder. The real terms — covering the sections below — are being
          finalised and will replace this text before launch.
        </p>
      </div>
      <ol className="flex flex-col gap-2 text-cream-dim">
        {SECTIONS.map((s, i) => (
          <li key={s}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <p className="text-sm text-cream-dim">
        Questions in the meantime?{' '}
        <Link href="/contact" className="underline hover:text-cream">
          Get in touch
        </Link>
        .
      </p>
    </main>
  );
}
