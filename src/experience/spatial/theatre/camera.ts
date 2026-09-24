/**
 * The opening's camera. One camera, seen by everything: the WebGL water, the 2D fallback water
 * and the DOM wordmark all read `cameraAt(p)`, so the push-through is a single move of the
 * viewer rather than several elements zooming in rough agreement.
 *
 * The camera is authored in Theatre.js and stored as `opening.theatre.json`.
 *
 * - WebGL tier: loads @theatre/core, which becomes the provider (and, in `next dev` with
 *   `?studio`, is live-editable in the Theatre studio).
 * - Everything else — the DOM before the spatial chunk arrives, and the no-WebGL fallback —
 *   evaluates the same JSON with the small evaluator below, so they never pay for the Theatre
 *   runtime. `scripts/test-camera.mjs` checks the two agree.
 *
 * `dolly` is the camera's magnification of the z = 0 plane (the plane the cleat and the water
 * sit in): 1 at rest, 4.8 when the reader has passed through the cleat.
 */

import state from './opening.theatre.json';

export const SHEET = 'Opening';
export const CAMERA_OBJECT = 'Camera';
export const SEQUENCE_LENGTH = state.sheetsById.Opening.sequence.length;

export interface CameraState {
  dolly: number;
}

export const CAMERA_DEFAULTS: CameraState = { dolly: 1 };

interface Keyframe {
  position: number;
  value: number;
  connectedRight: boolean;
  handles: readonly number[];
  type?: string;
}

type Provider = (p: number) => CameraState;

let provider: Provider = evaluateAuthoredCamera;

export function cameraAt(p: number): CameraState {
  return provider(p);
}

/** Hand the camera to the Theatre runtime. Returns a function that hands it back. */
export function setCameraProvider(next: Provider) {
  provider = next;
  return () => {
    if (provider === next) provider = evaluateAuthoredCamera;
  };
}

// ——— evaluator for the authored JSON (numeric bezier / hold keyframes only) ———

const tracks = state.sheetsById.Opening.sequence.tracksByObject.Camera;

function keyframesFor(prop: keyof CameraState): Keyframe[] {
  const id = (tracks.trackIdByPropPath as Record<string, string>)[JSON.stringify([prop])];
  const track = id ? (tracks.trackData as Record<string, { type: string; keyframes: Keyframe[] }>)[id] : undefined;
  if (!track) return [];
  if (track.type !== 'BasicKeyframedTrack') throw new Error(`camera: unsupported track type ${track.type}`);
  for (const k of track.keyframes) {
    if (k.type && k.type !== 'bezier' && k.type !== 'hold') throw new Error(`camera: unsupported keyframe type ${k.type}`);
  }
  return [...track.keyframes].sort((a, b) => a.position - b.position);
}

const DOLLY = keyframesFor('dolly');

export function evaluateAuthoredCamera(p: number): CameraState {
  return { dolly: evaluateTrack(DOLLY, p * SEQUENCE_LENGTH, CAMERA_DEFAULTS.dolly) };
}

function evaluateTrack(kfs: Keyframe[], t: number, fallback: number): number {
  if (kfs.length === 0) return fallback;
  const first = kfs[0]!;
  if (t < first.position) return first.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const left = kfs[i]!;
    const right = kfs[i + 1]!;
    if (t >= right.position) continue;
    if (!left.connectedRight || left.type === 'hold') return left.value;
    const local = (t - left.position) / (right.position - left.position);
    const eased = unitBezier(left.handles[2]!, left.handles[3]!, right.handles[0]!, right.handles[1]!, local);
    return left.value + (right.value - left.value) * eased;
  }
  return kfs[kfs.length - 1]!.value;
}

/** The same solver Theatre uses (WebKit UnitBezier, epsilon 1e-6). */
function unitBezier(p1x: number, p1y: number, p2x: number, p2y: number, x: number): number {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const eps = 1e-6;

  let t = x;
  for (let i = 0; i < 8; i++) {
    const dx = sampleX(t) - x;
    if (Math.abs(dx) < eps) return sampleY(t);
    const d = slopeX(t);
    if (Math.abs(d) < eps) break;
    t -= dx / d;
  }
  let lo = 0;
  let hi = 1;
  t = x;
  if (t < lo) return sampleY(lo);
  if (t > hi) return sampleY(hi);
  while (lo < hi) {
    const v = sampleX(t);
    if (Math.abs(v - x) < eps) return sampleY(t);
    if (x > v) lo = t;
    else hi = t;
    t = (hi - lo) * 0.5 + lo;
  }
  return sampleY(t);
}
