import type { MetadataRoute } from 'next';
import { SITE_URL } from './site-config';

// /lab/* is deliberately excluded: dev-only, 404s in production, and robots.ts already
// disallows it. Add a page here only once it is real enough for a search engine to find.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
