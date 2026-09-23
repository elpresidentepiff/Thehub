'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import './store';

const PerfOverlay = dynamic(() => import('./PerfOverlay'), { ssr: false });

/** Attaches field instrumentation after hydration; `?perf` adds the frame sampler and overlay. */
export function Instrumentation() {
  const [overlay, setOverlay] = useState(false);
  useEffect(() => {
    const perf = new URLSearchParams(location.search).has('perf');
    setOverlay(perf);
    void import('./instrumentation').then((m) => m.startInstrumentation({ sampleFrames: perf }));
  }, []);
  return overlay ? <PerfOverlay /> : null;
}
