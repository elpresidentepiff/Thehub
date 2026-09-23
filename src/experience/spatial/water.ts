/**
 * The Neckinger — the river that still runs under the building — as one formula.
 *
 * Carried verbatim from the prototype's canvas: 26 brass hairlines across the lower part of the
 * stage, amplitude, speed and opacity rising toward the viewer. Three renderers share it:
 *
 *   static SVG   first paint, no-JS and reduced motion      (WaterStatic)
 *   Canvas 2D    no WebGL2, software GL, low-memory devices (Water2D)
 *   WebGL2       the spatial runtime                        (Water — GLSL mirrors this file)
 */

export const WATER = {
  lines: 26,
  /** Horizontal wave frequencies, per CSS px. */
  k1: 0.0075,
  k2: 0.019,
  phase: 0.7,
  /** The prototype advanced t by 0.012 per frame; at 60 fps that is 0.72 per second. */
  timeScale: 0.72,
  ampBase: 2,
  ampRange: 11,
  speedBase: 0.4,
  speedRange: 0.9,
  alphaBase: 0.035,
  alphaRange: 0.075,
  /** Whole-layer opacity (the prototype's canvas `opacity: .55`). */
  opacity: 0.55,
  /** Top fraction of the water that fades from the ground colour. */
  fade: 0.38,
  /** Brass, #B97C3C. */
  rgb: [185, 124, 60] as const,
} as const;

export function lineParams(i: number) {
  const f = i / WATER.lines;
  return {
    f,
    amp: WATER.ampBase + f * WATER.ampRange,
    speed: WATER.speedBase + f * WATER.speedRange,
    alpha: WATER.alphaBase + WATER.alphaRange * f,
  };
}

/** y of line `i` at horizontal position `x` (CSS px) and time `t`, in a water band `h` px tall. */
export function lineY(i: number, x: number, t: number, h: number): number {
  const { f, amp, speed } = lineParams(i);
  return (
    h * f +
    Math.sin(x * WATER.k1 + t * speed + i * WATER.phase) * amp +
    Math.sin(x * WATER.k2 - t * speed * 0.6) * amp * 0.35
  );
}
