/**
 * The page's own performance record. Tiny and dependency-free so the main bundle can write to it;
 * web-vitals and the frame sampler are attached lazily (see instrumentation.ts).
 *
 * Exposed as `window.__hubPerf` — read by the ?perf overlay and by scripts/measure.mjs.
 */

export type SpatialTier = 'pending' | 'webgl' | 'canvas2d' | 'static';

export interface HubPerf {
  vitals: Record<string, { value: number; rating: string }>;
  spatial: {
    tier: SpatialTier;
    reason: string;
    renderer?: string;
    dpr?: number;
    /** ms from navigation start to the first live water frame on screen. */
    firstFrameAt?: number;
    /** ms from navigation start to the WebGL tier taking over from Canvas 2D. */
    webglReadyAt?: number;
  };
  longTasks: { count: number; totalMs: number };
  frames: number[];
}

export const hubPerf: HubPerf = {
  vitals: {},
  spatial: { tier: 'pending', reason: '' },
  longTasks: { count: 0, totalMs: 0 },
  frames: [],
};

if (typeof window !== 'undefined') {
  (window as unknown as { __hubPerf: HubPerf }).__hubPerf = hubPerf;
}

export function recordSpatial(patch: Partial<HubPerf['spatial']>) {
  Object.assign(hubPerf.spatial, patch);
}
