// Cleat studies — shared scroll engine and the two beats every study keeps:
// EST. 1857 + gold line at the start, the real walkthrough at the end.
//
//   ?t=0.42  freeze at a progress (review / screenshots)      ?auto  play by itself
//   prefers-reduced-motion: the study renders its finished still.

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const ramp = (p, a, b) => clamp((p - a) / (b - a));
export const easeOut = (x) => 1 - (1 - x) ** 3;
export const easeInOut = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = (c1, c2, t) => {
  const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [a, b] = [h(c1), h(c2)];
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`;
};

/** Where the study's own moment lives in the whole scroll. */
export const CLEAT = [0.1, 0.84];

const STUDIES = [
  ['rope.html', '1 Rope'],
  ['pour.html', '2 Pour'],
  ['halo.html', '3 Halo'],
  ['iron.html', '4 Iron'],
];

function chrome(studies, navLabel) {
  const here = location.pathname.split('/').pop();
  const nav = document.createElement('nav');
  nav.className = 'studies';
  nav.setAttribute('aria-label', navLabel ?? 'Studies');
  nav.innerHTML =
    studies.map(([href, label]) => `<a href="${href}"${href === here ? ' aria-current="page"' : ''}>${label}</a>`).join('') +
    '<button type="button" id="play">Play</button>';
  document.body.prepend(nav);
  const out = document.createElement('div');
  out.className = 'progress';
  document.body.append(out);
  return out;
}

/**
 * @param render          (progress) => void, called whenever shown progress changes
 * @param opts.studies    nav entries [[href, label], ...]; defaults to the four cleat studies
 * @param opts.navLabel   aria-label for the nav
 * @param opts.playMs     duration of the auto-play scroll (default 16s)
 */
export function run(render, opts = {}) {
  const readout = chrome(opts.studies ?? STUDIES, opts.navLabel);
  const playMs = opts.playMs ?? 16000;
  // Every study keeps the same two beats, but a much longer piece needs them to conclude
  // sooner (in scroll fraction) than the short four-beat cleat studies do.
  const est = opts.estWindow ?? [0, 0.03, 0.12, 0.17];
  const ruleWindow = opts.ruleWindow ?? [0.015, 0.09];
  const insideWindow = opts.insideWindow ?? [0.84, 0.93];
  const pillarsWindow = opts.pillarsWindow ?? [0.93, 0.99];
  const videoPlayAt = opts.videoPlayAt ?? 0.8;
  const q = new URLSearchParams(location.search);
  const fixed = q.has('t') ? clamp(Number(q.get('t'))) : null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const estLayer = document.querySelector('.est-layer');
  const rule = document.querySelector('.rule');
  const inside = document.querySelector('.inside');
  const video = inside?.querySelector('video');

  let target = 0;
  let shown = -1;
  let auto = null;

  const measure = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    target = max > 0 ? clamp(scrollY / max) : 0;
  };

  function frame(now) {
    if (auto) {
      const max = document.documentElement.scrollHeight - innerHeight;
      const t = clamp((now - auto.start) / auto.ms);
      scrollTo(0, easeInOut(t) * max);
      if (t >= 1) auto = null;
    }
    const goal = fixed ?? (reduced ? 1 : target);
    const p = shown < 0 || fixed !== null ? goal : lerp(shown, goal, 0.14);
    if (Math.abs(p - shown) > 1e-4) {
      shown = Math.abs(p - goal) < 1e-4 ? goal : p;
      // beat 1: EST. 1857 and the gold line
      if (estLayer) estLayer.style.opacity = String(ramp(shown, est[0], est[1]) * (1 - ramp(shown, est[2], est[3])));
      if (rule) rule.style.transform = `scaleX(${easeOut(ramp(shown, ...ruleWindow))})`;
      // last beat: the walkthrough
      if (inside) {
        inside.style.opacity = String(ramp(shown, ...insideWindow));
        const words = inside.querySelector('.pillars');
        if (words) words.style.opacity = String(ramp(shown, ...pillarsWindow));
        if (video) shown > videoPlayAt ? video.play().catch(() => {}) : video.pause();
      }
      render(shown);
      readout.textContent = shown.toFixed(2);
    }
    requestAnimationFrame(frame);
  }

  addEventListener('scroll', measure, { passive: true });
  addEventListener('resize', measure);
  document.getElementById('play').addEventListener('click', () => {
    scrollTo(0, 0);
    shown = 0;
    auto = { start: performance.now() + 400, ms: playMs };
  });
  if (q.has('auto')) auto = { start: performance.now() + 800, ms: playMs };
  measure();
  requestAnimationFrame(frame);
}
