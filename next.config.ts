import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

/**
 * Theatre.js studio is an editor. It is authored against in `next dev` only and must never
 * reach a production bundle (constitution: stack boundaries). Outside the dev server the
 * package is aliased to an empty stub, and `scripts/check-bundle.mjs` fails the build if a
 * studio marker appears in any emitted chunk anyway.
 */
export default function config(phase: string): NextConfig {
  const dev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    reactStrictMode: true,
    poweredByHeader: false,
    turbopack: {
      resolveAlias: dev ? {} : { '@theatre/studio': './src/experience/spatial/theatre/studio.stub.ts' },
    },
  };
}
