'use client';

import { useRef } from 'react';
import './opening.css';
import { Arrival } from './Arrival';
import { OpeningChrome } from './Chrome';
import { Cleat } from './Cleat';
import { Wordmark } from './Wordmark';
import { useOpeningSequence } from './useOpeningSequence';
import { SpatialStage } from '../spatial/SpatialStage';
import { useMotionMode } from '../runtime/motion';

/**
 * 1857 → the Neckinger → the illuminated cleat → THE HUB in real footage → through the letters →
 * inside Lloyds Wharf → WORK · MEET · CREATE · CONNECT · BELONG.
 *
 * The markup is the same in every mode. `html[data-motion]` picks the composition: `full` pins
 * the stage and scrubs the sequence; anything else (reduced motion, no JavaScript) lays the beats
 * out as a still, designed page.
 */
export function Opening() {
  const root = useRef<HTMLElement>(null);
  const mode = useMotionMode();
  useOpeningSequence(root, mode);

  return (
    <section ref={root} className="op-scroller" aria-label="The Hub at Lloyds Wharf, established 1857">
      <div className="op-stage">
        <SpatialStage />

        <div className="op-layer op-l1" data-l1>
          <div className="text-center">
            <p className="op-est">
              <span aria-hidden="true">
                EST<b>.</b> 1857
              </span>
              <span className="sr-only">Established 1857</span>
            </p>
            <div className="op-rule" data-rule />
          </div>
        </div>

        <div className="op-layer op-l2" data-l2>
          <Cleat />
        </div>

        <div className="op-layer op-l3" data-l3>
          <Wordmark />
        </div>

        <div className="op-layer op-l5" data-l5>
          <Arrival />
        </div>
      </div>

      <OpeningChrome />
    </section>
  );
}
