'use client';

import { useSyncExternalStore } from 'react';

/**
 * Two separate motion concerns.
 *
 * `mode` — which composition renders. `full` is the cinematic scroll sequence; `reduced` is the
 * designed static composition. Decided before first paint by the inline script in the root
 * layout (html[data-motion]) and kept in step with the OS setting afterwards.
 *
 * `paused` — the visitor's own stop control for anything that moves by itself (the water and the
 * footage). Scroll-driven motion is not affected: the reader is the one moving it.
 */

export type MotionMode = 'full' | 'reduced';

const PAUSE_KEY = 'hub:motion-paused';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let paused: boolean | null = null;

function readPaused(): boolean {
  if (paused === null) {
    try {
      paused = localStorage.getItem(PAUSE_KEY) === '1';
    } catch {
      paused = false;
    }
  }
  return paused;
}

export function setMotionPaused(next: boolean) {
  paused = next;
  try {
    localStorage.setItem(PAUSE_KEY, next ? '1' : '0');
  } catch {}
  emit();
}

export function isMotionPaused() {
  return readPaused();
}

function readMode(): MotionMode {
  return document.documentElement.dataset.motion === 'full' ? 'full' : 'reduced';
}

let watching = false;
function watchMode() {
  if (watching) return;
  watching = true;
  // Whoever sets html[data-motion] — this module, or the layout's watchdog — readers follow.
  new MutationObserver(emit).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  // Follow the OS setting live, unless the URL forced a mode (?motion=full|reduce).
  if (new URLSearchParams(location.search).has('motion')) return;
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    document.documentElement.dataset.motion = e.matches ? 'reduced' : 'full';
  });
}

function subscribe(listener: () => void) {
  watchMode();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `null` during SSR and hydration — the server does not know the mode. */
export function useMotionMode(): MotionMode | null {
  return useSyncExternalStore(subscribe, readMode, () => null);
}

export function useMotionPaused(): boolean {
  return useSyncExternalStore(subscribe, readPaused, () => false);
}

export function subscribeMotion(listener: () => void) {
  return subscribe(listener);
}
