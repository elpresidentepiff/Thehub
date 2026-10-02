import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The Hub at Lloyds Wharf',
    short_name: 'The Hub',
    description: 'Workspace in a Victorian wharf warehouse at 2 Mill Street, Shad Thames, London SE1 2BD. Established 1857.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0907',
    theme_color: '#0B0907',
    icons: [{ src: '/icon', sizes: '32x32', type: 'image/png' }],
  };
}
