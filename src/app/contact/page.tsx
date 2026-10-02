import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = { title: 'Contact' };

export default function ContactPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-8 bg-ink px-6 py-16 text-cream">
      <Link href="/" className="text-sm text-cream-dim transition hover:text-cream">
        ← The Hub at Lloyds Wharf
      </Link>
      <div>
        <h1 className="font-display text-3xl">Get in touch</h1>
        <p className="mt-3 text-cream-dim">
          2 Mill Street, Shad Thames, London SE1 2BD. Tell us what you're after and we'll come back to you.
        </p>
      </div>
      <ContactForm />
    </main>
  );
}
