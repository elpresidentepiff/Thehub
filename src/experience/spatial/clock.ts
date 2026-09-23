import { WATER } from './water';
import { isMotionPaused, subscribeMotion } from '../runtime/motion';

/**
 * One clock for the water, shared by every renderer, so the Canvas 2D → WebGL handover lands on
 * the same frame of the same river. Stops while the visitor has paused motion.
 */

let origin = -1;
let frozenAt = 0;
let pausedNow = false;
let bound = false;

function bind() {
  if (bound) return;
  bound = true;
  pausedNow = isMotionPaused();
  subscribeMotion(() => {
    const next = isMotionPaused();
    if (next === pausedNow) return;
    if (next) frozenAt = elapsed();
    else origin = performance.now() - frozenAt * 1000;
    pausedNow = next;
  });
}

function elapsed(): number {
  if (origin < 0) origin = performance.now();
  return (performance.now() - origin) / 1000;
}

/** Water time in the prototype's units (its `t`). */
export function waterTime(): number {
  bind();
  return (pausedNow ? frozenAt : elapsed()) * WATER.timeScale;
}

export function waterPaused(): boolean {
  bind();
  return pausedNow;
}
