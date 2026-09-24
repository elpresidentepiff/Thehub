/**
 * The opening sequence, as data.
 *
 * Every window below is carried verbatim from the approved prototype (proto/opening.html),
 * in normalised sequence progress: 0 = top of the opening, 1 = the last scroll position of it.
 * The GSAP timeline, the beat navigation, the video lazy-loading and the camera track all read
 * from here, so re-timing a beat is a one-line change that everything follows.
 */

export type Window = readonly [start: number, end: number];

export const BEATS = [
  { id: 'est', label: '1857', at: 0.02 },
  { id: 'cleat', label: 'Cleat', at: 0.3 },
  { id: 'through', label: 'Through', at: 0.61 },
  { id: 'inside', label: 'Inside', at: 0.88 },
] as const;

export type BeatId = (typeof BEATS)[number]['id'];

export const W = {
  hint: [0, 0.07],

  // 1 — EST. 1857
  estIn: [0, 0.06],
  estOut: [0.15, 0.24],
  rule: [0.02, 0.14],

  // 2 — the cleat, drawn by its own light, then the camera pushes through it
  //     (the HUB-letters beat was cut by the operator on 23 Sep; the prototype goes cleat → inside)
  cleatIn: [0.15, 0.21],
  cleatDraw: [0.17, 0.42],
  cleatLit: [0.27, 0.46],
  push: [0.5, 0.73],
  cleatOut: [0.48, 0.72],

  // 3 — inside Lloyds Wharf
  insideIn: [0.58, 0.76],
  pillars: [0.84, 1],
} as const satisfies Record<string, Window>;

/** Delay between successive cleat strokes, as a fraction of the draw. */
export const STROKE_STAGGER = 0.055;
/** Blur at the end of the push-through, in CSS px (the prototype's 7·push²). */
export const PUSH_BLUR = 7;
/** Tilt of the lit cleat, and how far it tips back as the camera goes through (degrees). */
export const CLEAT_TILT = { lit: 5, push: -12 } as const;

/** When each clip starts downloading. Early enough to be ready, late enough to save data. */
export const VIDEO_WARM = { arrive: W.cleatLit[1] } as const;

/** The static-to-live water handover and the point past which the water is fully covered. */
export const WATER_COVERED_AT = W.insideIn[1];

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Linear 0..1 ramp between the two ends of a window. */
export const seg = (p: number, [a, b]: Window) => clamp((p - a) / (b - a), 0, 1);

/** The prototype's `ease` — cubic in-out. GSAP's `power2.inOut` is the same curve. */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Index of the beat the reader is in, using the prototype's 0.02 look-ahead. */
export function activeBeat(p: number): number {
  let active = 0;
  for (let i = 0; i < BEATS.length; i++) if (p >= BEATS[i]!.at - 0.02) active = i;
  return active;
}

/** Whether each clip should be playing at progress `p` — the prototype's own conditions. */
export function videoShouldPlay(p: number) {
  const inside = easeInOutCubic(seg(p, W.insideIn));
  return { arrive: inside > 0.02 };
}
