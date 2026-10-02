'use client';

import { useState } from 'react';
import { CONTACT_EMAIL } from '../site-config';

/**
 * No backend exists yet (no Supabase, no email-sending service) — rather than a form that
 * silently swallows a real enquiry, this builds a mailto: and hands off to the visitor's own
 * mail client. It genuinely works today. Once an email-sending service is wired up this can
 * become a real server-side submit without changing the markup.
 */
export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const mailto = () => {
    const subject = `Enquiry from ${name || 'the website'}`;
    const body = `${message}\n\n— ${name}${email ? ` (${email})` : ''}`;
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        window.location.href = mailto();
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-cream-dim">Name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-sm border border-steel-2/40 bg-ink-2 px-3 py-2 text-cream outline-none focus:border-brass"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-cream-dim">Email</span>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-sm border border-steel-2/40 bg-ink-2 px-3 py-2 text-cream outline-none focus:border-brass"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-cream-dim">Message</span>
        <textarea
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="resize-y rounded-sm border border-steel-2/40 bg-ink-2 px-3 py-2 text-cream outline-none focus:border-brass"
        />
      </label>
      <button
        type="submit"
        className="mt-2 self-start border-b border-brass pb-1 text-brass transition hover:text-halo-warm"
      >
        Send enquiry
      </button>
      <p className="text-xs text-cream-dim">
        Opens in your email app, addressed to {CONTACT_EMAIL}. Prefer to write directly?{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-cream">
          {CONTACT_EMAIL}
        </a>
      </p>
    </form>
  );
}
