// The Lloyds Wharf cleat (assets/brand/cleat.svg), 1000 × 340 units, as reusable markup.
export const HORN =
  'M 26 52 C 170 22, 350 14, 500 14 C 650 14, 830 22, 974 52 C 990 62, 988 82, 966 88 ' +
  'C 830 68, 650 60, 500 60 C 350 60, 170 68, 34 88 C 12 82, 10 62, 26 52 Z';

export const PARTS = `
  <path d="${HORN}"/>
  <path d="M 196 62 C 202 122, 252 172, 322 200 C 394 224, 606 224, 678 200 C 748 172, 798 122, 804 62"/>
  <path d="M 500 60 L 500 288"/>
  <path d="M 240 150 L 190 288 L 810 288 L 760 150"/>
  <rect x="252" y="190" width="30" height="44" rx="14"/>
  <rect x="718" y="190" width="30" height="44" rx="14"/>
  <circle cx="238" cy="262" r="14"/>
  <circle cx="762" cy="262" r="14"/>`;

/** Each part's length, so strokes can be drawn on with stroke-dash. */
export function prepareDraw(group) {
  const parts = [...group.querySelectorAll('path,rect,circle')];
  for (const el of parts) {
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len} ${len}`;
    el.style.strokeDashoffset = String(len);
    el.dataset.len = String(len);
  }
  return (t, stagger = 0.06) =>
    parts.forEach((el, i) => {
      const local = Math.min(1, Math.max(0, (t - i * stagger) / (1 - stagger * (parts.length - 1))));
      el.style.strokeDashoffset = String(Number(el.dataset.len) * (1 - local));
    });
}
