'use client';

import { useEffect, useState } from 'react';
import { frameStats } from './instrumentation';
import { hubPerf } from './store';
import { story } from '../runtime/story';

/** `?perf` — a small read-out for review on real devices. Not part of the design. */
export default function PerfOverlay() {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const f = frameStats(hubPerf.frames.slice(-120));
  const v = hubPerf.vitals;
  const s = hubPerf.spatial;
  const fmt = (n: number | undefined, d = 0) => (n === undefined ? '–' : n.toFixed(d));
  const rows: [string, string][] = [
    ['tier', `${s.tier} · ${s.reason}`],
    ['gpu', s.renderer ?? '–'],
    ['dpr', fmt(s.dpr, 2)],
    ['fps', f ? `${fmt(f.fps)} (p95 ${fmt(f.p95, 1)} ms)` : '–'],
    ['lcp', `${fmt(v.LCP?.value)} ms`],
    ['cls', fmt(v.CLS?.value, 3)],
    ['inp', `${fmt(v.INP?.value)} ms`],
    ['long tasks', `${hubPerf.longTasks.count} · ${fmt(hubPerf.longTasks.totalMs)} ms`],
    ['progress', story.progress.toFixed(3)],
  ];

  return (
    <dl
      style={{
        position: 'fixed',
        left: 8,
        bottom: 8,
        zIndex: 50,
        margin: 0,
        padding: '8px 10px',
        display: 'grid',
        gridTemplateColumns: 'auto auto',
        gap: '2px 10px',
        maxWidth: 'min(92vw, 360px)',
        font: '11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'var(--hub-cream)',
        background: 'color-mix(in srgb, var(--hub-ink) 86%, transparent)',
        border: '1px solid var(--hub-brass-deep)',
        pointerEvents: 'none',
      }}
    >
      {rows.map(([k, val]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt style={{ color: 'var(--hub-cream-dim)' }}>{k}</dt>
          <dd style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</dd>
        </div>
      ))}
    </dl>
  );
}
