'use client';

import { useEffect, useRef } from 'react';
import { WATER, lineParams, lineY } from './water';
import { waterTime } from './clock';
import { cameraAt } from './theatre/camera';
import { WATER_COVERED_AT } from '../opening/choreography';
import { story } from '../runtime/story';
import { hubPerf, recordSpatial } from '../perf/store';

const STROKES = Array.from({ length: WATER.lines }, (_, i) => {
  const [r, g, b] = WATER.rgb;
  return `rgba(${r},${g},${b},${lineParams(i).alpha.toFixed(3)})`;
});

/**
 * The Neckinger on Canvas 2D — the prototype's own renderer, kept as the no-WebGL tier and as
 * the first live frame on every device while the WebGL chunk loads.
 *
 * It sees the same camera as the WebGL tier: during the push-through the band is magnified about
 * the centre of the stage by the camera's dolly.
 */
export function Water2D({ animate }: { animate: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let centreY = 0;
    let raf = 0;
    let first = true;
    let lastP = -1;
    let lastT = -1;

    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const slot = cv.parentElement;
      const stage = slot?.offsetParent as HTMLElement | null;
      centreY = (stage ? stage.clientHeight / 2 : innerHeight / 2) - (slot?.offsetTop ?? 0);
    };

    const draw = () => {
      const p = animate ? story.progress : 0;
      const t = animate ? waterTime() : 0;
      if (!first && (p >= WATER_COVERED_AT || (p === lastP && t === lastT))) return; // covered, or nothing moved
      lastP = p;
      lastT = t;
      const s = animate ? cameraAt(p).dolly : 1;
      const ox = w / 2;
      const oy = centreY;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (1 - s) * ox, dpr * (1 - s) * oy);

      const x0 = ox - ox / s;
      const x1 = ox + (w - ox) / s;
      const step = 9 / s;
      ctx.lineWidth = 1;
      for (let i = 0; i < WATER.lines; i++) {
        ctx.beginPath();
        ctx.moveTo(x0, lineY(i, x0, t, h));
        for (let x = x0 + step; x <= x1 + step; x += step) ctx.lineTo(x, lineY(i, x, t, h));
        ctx.strokeStyle = STROKES[i]!;
        ctx.stroke();
      }

      // Fade the top of the band back into the ground, in the water's own coordinates.
      const fadeH = h * WATER.fade;
      const g = ctx.createLinearGradient(0, 0, 0, fadeH);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = g;
      ctx.fillRect(x0, -h, x1 - x0, h + fadeH);
      ctx.globalCompositeOperation = 'source-over';

      if (first) {
        first = false;
        if (animate && hubPerf.spatial.firstFrameAt === undefined) recordSpatial({ firstFrameAt: Math.round(performance.now()) });
      }
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };

    const onResize = () => {
      size();
      first = true;
      draw();
    };

    size();
    if (animate) loop();
    else draw();
    const ro = new ResizeObserver(onResize);
    ro.observe(cv);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [animate]);

  return <canvas ref={ref} className="op-water-canvas" />;
}
