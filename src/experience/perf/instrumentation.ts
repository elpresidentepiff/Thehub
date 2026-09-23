import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';
import { hubPerf } from './store';

/**
 * Field instrumentation, attached after hydration.
 *
 * - Core Web Vitals (LCP, CLS, INP, FCP, TTFB) into window.__hubPerf, and to
 *   NEXT_PUBLIC_VITALS_ENDPOINT by sendBeacon when that is configured.
 * - Long tasks on the main thread.
 * - With ?perf: a frame-time sampler (every rAF interval, last ~20 s) for the overlay and for
 *   scripts/measure.mjs. Visitors without ?perf never run it.
 */

const endpoint = process.env.NEXT_PUBLIC_VITALS_ENDPOINT;
let started = false;

export function startInstrumentation({ sampleFrames }: { sampleFrames: boolean }) {
  if (started) return;
  started = true;

  const report = (m: Metric) => {
    hubPerf.vitals[m.name] = { value: m.value, rating: m.rating };
    if (endpoint) {
      const body = JSON.stringify({
        name: m.name,
        value: m.value,
        rating: m.rating,
        id: m.id,
        page: location.pathname,
        spatial: hubPerf.spatial.tier,
      });
      navigator.sendBeacon?.(endpoint, body);
    }
  };
  onLCP(report);
  onCLS(report);
  onINP(report);
  onFCP(report);
  onTTFB(report);

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        hubPerf.longTasks.count += 1;
        hubPerf.longTasks.totalMs += e.duration;
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {}

  if (sampleFrames) {
    const MAX = 1200;
    let last = performance.now();
    const tick = (now: number) => {
      hubPerf.frames.push(now - last);
      if (hubPerf.frames.length > MAX) hubPerf.frames.shift();
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

export function frameStats(frames: number[] = hubPerf.frames) {
  if (frames.length === 0) return null;
  const sorted = [...frames].sort((a, b) => a - b);
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  const p50 = pick(0.5);
  return {
    count: frames.length,
    fps: 1000 / p50,
    p50,
    p95: pick(0.95),
    p99: pick(0.99),
    max: sorted[sorted.length - 1]!,
    /** Frames that took more than 1.5 display refreshes (a visible hitch). */
    dropped: frames.filter((f) => f > p50 * 1.5).length,
  };
}
