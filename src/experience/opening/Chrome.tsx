'use client';

import { useSyncExternalStore } from 'react';
import { BEATS, activeBeat } from './choreography';
import { setMotionPaused, useMotionPaused } from '../runtime/motion';
import { sequenceNav } from '../runtime/sequence-nav';
import { story } from '../runtime/story';

/** Controls that sit over the sequence. All of them are hidden in the static composition. */
export function OpeningChrome() {
  return (
    <>
      <div className="op-hint" data-hint aria-hidden="true">
        <span>SCROLL</span>
        <span className="op-hint-bar" />
      </div>
      <BeatNav />
      <MotionToggle />
    </>
  );
}

const subscribeBeat = (cb: () => void) => story.subscribe(cb);
const readBeat = () => activeBeat(story.progress);

function BeatNav() {
  const active = useSyncExternalStore(subscribeBeat, readBeat, () => 0);
  return (
    <nav className="op-beats" aria-label="Opening sequence">
      {BEATS.map((beat, i) => (
        <button
          key={beat.id}
          type="button"
          title={beat.label}
          aria-label={`Go to ${beat.label}`}
          aria-current={i === active ? 'step' : undefined}
          onClick={() => sequenceNav.to(beat.at)}
        >
          <i />
        </button>
      ))}
    </nav>
  );
}

/**
 * The footage and the water move on their own and loop, so they get a stop control
 * (WCAG 2.2.2). The choice is remembered.
 */
function MotionToggle() {
  const paused = useMotionPaused();
  return (
    <button type="button" className="op-motion hub-label" onClick={() => setMotionPaused(!paused)}>
      {paused ? 'Play motion' : 'Pause motion'}
    </button>
  );
}
