import { VIDEO_WARM, videoShouldPlay } from './choreography';

/** Real Lloyds Wharf walkthrough footage (720×1280 portrait, H.264, faststart). */
export const MEDIA = {
  arrive: { src: '/media/arrive.mp4', poster: '/media/arrive_poster.jpg' },
} as const;

type Clip = keyof typeof MEDIA;

/**
 * Lazy footage. Clips carry `data-src` and `preload="none"` in the markup, so the page loads with
 * posters only. A clip's source is attached when the reader reaches its warm-up point in the
 * sequence, and it plays only while it is on screen.
 */
export function createMediaController(root: HTMLElement) {
  const clips = {
    arrive: root.querySelector<HTMLVideoElement>('[data-video="arrive"]'),
  } satisfies Record<Clip, HTMLVideoElement | null>;

  const warm = (v: HTMLVideoElement | null) => {
    if (!v || v.getAttribute('src') || !v.dataset.src) return;
    v.preload = 'auto';
    v.src = v.dataset.src;
  };

  const run = (v: HTMLVideoElement | null, on: boolean) => {
    if (!v) return;
    if (on) {
      warm(v);
      if (v.paused) v.play().catch(() => {});
    } else if (!v.paused) v.pause();
  };

  return {
    update(p: number, paused: boolean) {
      if (p >= VIDEO_WARM.arrive) warm(clips.arrive);
      const play = videoShouldPlay(p);
      run(clips.arrive, play.arrive && !paused);
    },
    stop() {
      clips.arrive?.pause();
    },
  };
}
