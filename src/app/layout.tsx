import type { Metadata, Viewport } from 'next';
import { Archivo, Archivo_Black } from 'next/font/google';
import type { ReactNode } from 'react';
import { Instrumentation } from '@/experience/perf/Instrumentation';
import './globals.css';
import { SITE_URL } from './site-config';

const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo', display: 'swap' });
const archivoBlack = Archivo_Black({ subsets: ['latin'], weight: '400', variable: '--font-archivo-black', display: 'swap' });

const TITLE = 'The Hub at Lloyds Wharf';
const DESCRIPTION =
  'Workspace in a Victorian wharf warehouse at 2 Mill Street, Shad Thames, London SE1 2BD. Established 1857.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s — ${TITLE}` },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    siteName: TITLE,
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: '#0B0907',
  colorScheme: 'dark',
  viewportFit: 'cover',
};

/**
 * Runs before first paint. Chooses the composition (html[data-motion]) so the page never flashes
 * the wrong one, and arms a watchdog: if the sequence has not taken over within 10 s — a script
 * error, a failed chunk — the page falls back to the still composition rather than sitting on
 * its hidden initial state. No JavaScript at all means no data-motion: the still composition.
 *
 * ?motion=reduce and ?motion=full override the OS setting, for review.
 */
const MOTION_SCRIPT = `(function(){try{
var d=document.documentElement,q=new URLSearchParams(location.search).get('motion');
var r=q==='reduce'||(q!=='full'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
d.dataset.motion=r?'reduced':'full';
if(!r)setTimeout(function(){if(d.dataset.motion==='full'&&d.dataset.seq!=='ready'){d.dataset.motion='reduced';d.dataset.fallback='watchdog';}},10000);
}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" className={`${archivo.variable} ${archivoBlack.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_SCRIPT }} />
      </head>
      <body>
        {children}
        <Instrumentation />
      </body>
    </html>
  );
}
