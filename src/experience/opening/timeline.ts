import { gsap } from 'gsap';
import { CLEAT_TILT, PUSH_BLUR, STROKE_STAGGER, W, type Window } from './choreography';

/**
 * The prototype's per-frame style arithmetic, restated as one GSAP timeline 1 unit long, so that
 * timeline time == sequence progress and ScrollTrigger can scrub it directly.
 *
 * `power2.inOut` is the prototype's cubic in-out. `none` is its linear `seg()`.
 *
 * Not in this timeline: the cleat's scale during the push. That is the camera's job (see
 * useOpeningSequence).
 */

const E = 'power2.inOut';
const start = (w: Window) => w[0];
const span = (w: Window) => w[1] - w[0];

type Query = (selector: string) => Element[];

export function buildOpeningTimeline(q: Query): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });

  // chrome
  tl.fromTo(q('[data-hint]'), { opacity: 1 }, { opacity: 0, duration: span(W.hint) }, start(W.hint));

  // 1 — EST. 1857
  const l1 = q('[data-l1]');
  tl.fromTo(l1, { opacity: 0 }, { opacity: 1, duration: span(W.estIn) }, start(W.estIn))
    .to(l1, { opacity: 0, y: -26, duration: span(W.estOut) }, start(W.estOut))
    .fromTo(q('[data-rule]'), { scaleX: 0 }, { scaleX: 1, ease: E, duration: span(W.rule) }, start(W.rule));

  // 2 — the cleat, drawn by its own light
  const l2 = q('[data-l2]');
  const wrap = q('[data-cleatwrap]');
  const strokes = q('.op-stroke');
  // Strokes draw linearly and staggered; the whole draw is then eased as one gesture.
  // Stroke i starts at i·s and runs for 1 − i·s/2 of the draw — the prototype's own timing.
  // In the prototype that leaves the last strokes 76–97% drawn when the draw ends, so the two
  // small circles never close. Here the same timing is scaled by 1/k so every stroke completes.
  const draw = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  const k = 1 + (STROKE_STAGGER / 2) * (strokes.length - 1);
  strokes.forEach((stroke, i) => {
    draw.fromTo(
      stroke,
      { strokeDashoffset: 1 },
      // pathLength is 1, so the draw lives between 1px and 0px: GSAP's default whole-pixel
      // rounding would turn it into a single jump.
      { strokeDashoffset: 0, duration: (1 - (i * STROKE_STAGGER) / 2) / k, autoRound: false },
      (i * STROKE_STAGGER) / k,
    );
  });
  tl.fromTo(l2, { opacity: 0 }, { opacity: 1, duration: span(W.cleatIn) }, start(W.cleatIn))
    .to(l2, { opacity: 0, duration: span(W.cleatOut) }, start(W.cleatOut))
    .fromTo(draw, { progress: 0 }, { progress: 1, ease: E, duration: span(W.cleatDraw) }, start(W.cleatDraw))
    .fromTo(q('[data-cleatglow]'), { opacity: 0 }, { opacity: 1, ease: E, duration: span(W.cleatLit) }, start(W.cleatLit))
    .fromTo(wrap, { '--lit': 0 }, { '--lit': 1, ease: E, duration: span(W.cleatLit) }, start(W.cleatLit))
    // The prototype's rotateX(5·lit − 12·push): it tips towards you as it lights, back as you pass.
    .fromTo(
      wrap,
      { rotationX: 0, transformPerspective: 900 },
      { rotationX: CLEAT_TILT.lit, ease: E, duration: span(W.cleatLit) },
      start(W.cleatLit),
    )
    .to(wrap, { rotationX: CLEAT_TILT.lit + CLEAT_TILT.push, ease: E, duration: span(W.push) }, start(W.push))
    // …and its blur, 7·push², i.e. quadratic-in over the push.
    .fromTo(
      wrap,
      { '--blur': '0px' },
      { '--blur': `${PUSH_BLUR}px`, ease: 'power1.in', duration: span(W.push), immediateRender: false },
      start(W.push),
    );

  // 3 — inside
  tl.fromTo(
    q('[data-l5]'),
    { opacity: 0, scale: 1.14 },
    { opacity: 1, scale: 1, ease: E, duration: span(W.insideIn) },
    start(W.insideIn),
  )
    .fromTo(q('[data-pillars]'), { opacity: 0, y: 22 }, { opacity: 1, y: 0, ease: E, duration: span(W.pillars) }, start(W.pillars))
    .fromTo(
      q('[data-arrival-action]'),
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, ease: E, duration: span(W.pillars) * 0.75 },
      start(W.pillars) + span(W.pillars) * 0.25,
    );

  // Pin the timeline to exactly one unit so time == progress.
  tl.set({}, {}, 1);
  return tl;
}
