'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { decideSpatial } from './capability';
import { Water2D } from './Water2D';
import { useMotionMode } from '../runtime/motion';
import { recordSpatial } from '../perf/store';

// three + R3F + Drei + Theatre core: fetched after first paint, and only by devices that pass the
// WebGL2 gate. Everything else never downloads it.
const WebGLStage = dynamic(() => import('./WebGLStage'), { ssr: false });

/**
 * The stage's spatial layer. The water band is a DOM slot so its composition lives in CSS; the
 * renderer inside it is chosen per device:
 *
 *   reduced motion         Canvas 2D, one still frame
 *   full, first paint      Canvas 2D, live — immediately, no heavy chunk required
 *   full, WebGL2 passes    the R3F stage takes over on the same frame of the same river
 *   full, WebGL2 fails     stays on Canvas 2D (and so does a lost context)
 */
export function SpatialStage() {
  const mode = useMotionMode();
  const slotRef = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState(false);
  const [webglReady, setWebglReady] = useState(false);

  useEffect(() => {
    if (mode !== 'full') {
      if (mode === 'reduced') recordSpatial({ tier: 'static', reason: 'reduced motion' });
      setWebgl(false);
      setWebglReady(false);
      return;
    }
    recordSpatial({ tier: 'canvas2d', reason: 'first paint' });
    const decide = () => {
      const d = decideSpatial();
      recordSpatial({ tier: d.tier, reason: d.reason, renderer: d.renderer });
      setWebgl(d.tier === 'webgl');
    };
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(decide, { timeout: 1200 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(decide, 200);
    return () => clearTimeout(id);
  }, [mode]);

  return (
    <>
      <div ref={slotRef} className="op-water" aria-hidden="true">
        {mode && !webglReady && <Water2D animate={mode === 'full'} />}
      </div>
      {webgl && (
        <div className="op-spatial" aria-hidden="true">
          <WebGLStage
            slotRef={slotRef}
            onReady={() => setWebglReady(true)}
            onLost={(reason) => {
              recordSpatial({ tier: 'canvas2d', reason });
              setWebglReady(false);
              setWebgl(false);
            }}
          />
        </div>
      )}
    </>
  );
}
