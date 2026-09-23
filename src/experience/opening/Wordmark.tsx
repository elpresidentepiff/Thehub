import { useId } from 'react';
import { MEDIA } from './media';

/**
 * THE HUB @ LLOYDS WHARF, with the walkthrough footage showing through the letters of HUB.
 * The letters are knocked out of an ink plate laid over the video, as in the prototype.
 */
export function Wordmark() {
  const mask = `knock-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <div className="op-wordmark" data-wordmark>
      <h1 className="op-h1">
        <span className="sr-only">The Hub at Lloyds Wharf</span>
        <span className="op-the" aria-hidden="true">
          THE
        </span>
        <span className="op-hubtype" aria-hidden="true">
          <video
            className="op-typevideo"
            data-video="type"
            data-src={MEDIA.type.src}
            poster={MEDIA.type.poster}
            muted
            loop
            playsInline
            preload="none"
            tabIndex={-1}
          />
          <svg viewBox="0 0 1000 260" preserveAspectRatio="none" focusable="false">
            <defs>
              <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="260">
                <rect x="0" y="0" width="1000" height="260" fill="#fff" />
                <text
                  x="500"
                  y="212"
                  textAnchor="middle"
                  fill="#000"
                  fontSize="268"
                  letterSpacing="6"
                  style={{ fontFamily: 'var(--hub-display)' }}
                >
                  HUB
                </text>
              </mask>
            </defs>
            <rect x="0" y="0" width="1000" height="260" fill="var(--hub-ink)" mask={`url(#${mask})`} />
          </svg>
          <span className="op-sheen" data-sheen />
        </span>
        <span className="op-wharf" aria-hidden="true">
          @ LLOYDS WHARF
        </span>
      </h1>
    </div>
  );
}
