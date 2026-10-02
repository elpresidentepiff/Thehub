'use client';

import { useEffect } from 'react';

// App Router requires this to be a client component. Kept deliberately plain — no WebGL, no
// motion, nothing that could itself be the thing that's broken.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-cream">
      <p className="font-display text-sm tracking-[0.3em] text-cream-dim">SOMETHING WENT WRONG</p>
      <h1 className="font-display text-3xl">Give it another try</h1>
      <p className="max-w-prose text-cream-dim">
        That didn't load properly. It's on us, not you — try again, or come back in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 border-b border-brass pb-1 text-brass transition hover:text-halo-warm"
      >
        Try again
      </button>
    </main>
  );
}
