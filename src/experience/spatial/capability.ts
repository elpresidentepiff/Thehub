/**
 * Which spatial tier this device gets. WebGL2 is the release gate: no WebGL2, a software
 * rasteriser, or a device that says it is short of memory or data all get the Canvas 2D water,
 * which draws the same river from the same formula.
 *
 * QA overrides: `?gl=0` forces Canvas 2D; `?gl=1` forces WebGL even on a software rasteriser
 * (used by headless measurement, where the GPU is SwiftShader).
 */

export type SpatialDecision =
  | { tier: 'webgl'; reason: string; renderer: string }
  | { tier: 'canvas2d'; reason: string; renderer?: string };

type NavigatorHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

export function decideSpatial(): SpatialDecision {
  const force = new URLSearchParams(location.search).get('gl');
  if (force === '0') return { tier: 'canvas2d', reason: 'forced (?gl=0)' };

  const nav = navigator as NavigatorHints;
  if (force !== '1') {
    if (nav.connection?.saveData) return { tier: 'canvas2d', reason: 'Save-Data' };
    if (nav.deviceMemory !== undefined && nav.deviceMemory < 2) return { tier: 'canvas2d', reason: `deviceMemory ${nav.deviceMemory}GB` };
  }

  const probe = (strict: boolean) => {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: strict, powerPreference: 'high-performance' });
  };

  const strict = force !== '1';
  const gl = probe(strict);
  if (!gl) {
    if (strict && probe(false)) return { tier: 'canvas2d', reason: 'WebGL2 is software-rendered' };
    return { tier: 'canvas2d', reason: 'no WebGL2' };
  }
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return { tier: 'webgl', reason: force === '1' ? 'forced (?gl=1)' : 'WebGL2', renderer };
}
