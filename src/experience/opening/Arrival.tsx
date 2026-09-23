import { MEDIA } from './media';

const PILLARS = ['WORK', 'MEET', 'CREATE', 'CONNECT', 'BELONG'] as const;

/**
 * Arrival inside Lloyds Wharf, and the five words — the site's information architecture.
 * On a phone the line is set deliberately as WORK · MEET · CREATE / CONNECT · BELONG rather than
 * wherever the flex row happens to wrap.
 */
export function Arrival() {
  return (
    <>
      <video
        className="op-arrivevideo"
        data-video="arrive"
        data-src={MEDIA.arrive.src}
        poster={MEDIA.arrive.poster}
        muted
        loop
        playsInline
        preload="none"
        tabIndex={-1}
        aria-hidden="true"
      />
      <div className="op-insidegrade" aria-hidden="true" />
      <ul className="op-pillars" data-pillars>
        {PILLARS.map((word, i) => (
          <PillarItem key={word} word={word} i={i} />
        ))}
      </ul>
    </>
  );
}

function PillarItem({ word, i }: { word: string; i: number }) {
  const last = i === PILLARS.length - 1;
  const lineEnd = i === 2;
  return (
    <>
      <li>
        {word}
        {!last && (
          <i className={lineEnd ? 'op-dot op-dot--eol' : 'op-dot'} aria-hidden="true">
            {' ·'}
          </i>
        )}
      </li>
      {lineEnd && <li className="op-break" aria-hidden="true" role="presentation" />}
    </>
  );
}
