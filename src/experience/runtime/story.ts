/**
 * Sequence progress, 0..1. ScrollTrigger is the only writer; the camera, the spatial scene,
 * the beat navigation and the media controller are readers.
 *
 * Deliberately a plain mutable value rather than React state: it changes every frame while
 * scrolling and the readers that run per-frame (useFrame, the 2D water) should not re-render.
 */

type Listener = (p: number) => void;

const listeners = new Set<Listener>();
let progress = 0;

export const story = {
  get progress() {
    return progress;
  },
  set(p: number) {
    if (p === progress) return;
    progress = p;
    listeners.forEach((l) => l(p));
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
