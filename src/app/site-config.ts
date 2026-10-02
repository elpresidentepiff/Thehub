// The one place the production domain is named. No domain has been registered/confirmed yet
// (checked: no vercel.json, no package.json homepage, nothing in docs/plan) — this placeholder
// must be swapped for the real one, and NEXT_PUBLIC_SITE_URL set in the deploy environment,
// before launch. Everything that needs an absolute URL (sitemap, robots, Open Graph) reads
// from here so there is exactly one place to fix.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thehub-lloydswharf.example';

// Same story: no real enquiries inbox has been confirmed yet. The contact form works today
// (it builds a mailto: — no backend needed) but it is genuinely sending to this placeholder
// until it's swapped for the real address.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@thehub-lloydswharf.example';
