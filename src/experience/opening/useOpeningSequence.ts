'use client';

import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import type { RefObject } from 'react';
import { createMediaController } from './media';
import { buildOpeningTimeline } from './timeline';
import { cameraAt } from '../spatial/theatre/camera';
import { isMotionPaused, subscribeMotion, type MotionMode } from '../runtime/motion';
import { sequenceNav } from '../runtime/sequence-nav';
import { story } from '../runtime/story';

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * The cinematic opening: Lenis smooths the scroll, ScrollTrigger maps it to 0..1, and that one
 * number drives the GSAP timeline, the camera, the footage and the beat navigation.
 *
 * Only runs in `full` motion mode. In `reduced` mode nothing here executes and the page is the
 * designed static composition.
 */
export function useOpeningSequence(root: RefObject<HTMLElement | null>, mode: MotionMode | null) {
  useGSAP(
    () => {
      const el = root.current;
      if (!el || mode !== 'full') return;
      const q = gsap.utils.selector(el);

      const tl = buildOpeningTimeline(q);
      const media = createMediaController(el);

      // The push-through is a camera move, not a tween: the cleat sits in the z = 0 plane, so its
      // on-screen scale is the camera's dolly, shared with the water beneath it.
      const setCleat = gsap.quickSetter(q('[data-cleatwrap]'), 'css');

      const onProgress = (p: number) => {
        story.set(p);
        setCleat({ scale: cameraAt(p).dolly });
        media.update(p, isMotionPaused());
      };

      const lenis = new Lenis({ autoRaf: false, anchors: false });
      const raf = (time: number) => lenis.raf(time * 1000);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      // Heights are in svh, so the mobile URL bar showing and hiding is not a layout change.
      ScrollTrigger.config({ ignoreMobileResize: true });

      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        animation: tl,
        onUpdate: (self) => onProgress(self.progress),
        onRefresh: (self) => onProgress(self.progress),
      });
      onProgress(st.progress);

      const releaseNav = sequenceNav.register((p) => {
        lenis.scrollTo(st.start + (st.end - st.start) * p, { duration: 1.4 });
      });
      const releaseMotion = subscribeMotion(() => media.update(story.progress, isMotionPaused()));

      document.documentElement.dataset.seq = 'ready';

      return () => {
        delete document.documentElement.dataset.seq;
        releaseNav();
        releaseMotion();
        media.stop();
        gsap.ticker.remove(raf);
        lenis.destroy();
        story.set(0);
      };
    },
    { scope: root, dependencies: [mode], revertOnUpdate: true },
  );
}
