'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import './floor-reality.css';

const LAB_MARKER = '__HUB_LAB__';

const VIEWS = [
  {
    id: 'threshold',
    number: '01',
    label: 'Threshold',
    detail: 'The long view into the floor: herringbone, timber and black-framed glass.',
    src: '/media/floor-survey/photo_2026-09-28_10-18-32.jpg',
    x: 77,
    y: 66,
  },
  {
    id: 'glass-line',
    number: '02',
    label: 'Glass line',
    detail: 'A clear route between the open desks and enclosed rooms.',
    src: '/media/floor-survey/photo_2026-09-28_10-18-47.jpg',
    x: 69,
    y: 57,
  },
  {
    id: 'brick-bay',
    number: '03',
    label: 'Brick bay',
    detail: 'The quieter desk bay against the original warehouse wall.',
    src: '/media/floor-survey/photo_2026-09-28_10-18-54.jpg',
    x: 60,
    y: 45,
  },
  {
    id: 'main-office',
    number: '04',
    label: 'Main office',
    detail: 'The working floor beneath timber beams, ducts and linear light.',
    src: '/media/floor-survey/photo_2026-09-28_10-19-00.jpg',
    x: 54,
    y: 36,
  },
  {
    id: 'acoustic-wall',
    number: '05',
    label: 'Acoustic wall',
    detail: 'A transition from the open desks toward the window lounge.',
    src: '/media/floor-survey/photo_2026-09-28_10-19-08.jpg',
    x: 45,
    y: 32,
  },
  {
    id: 'window-lounge',
    number: '06',
    label: 'Window lounge',
    detail: 'Exposed brick, arched window and the soft seating corner.',
    src: '/media/floor-survey/photo_2026-09-28_10-19-16.jpg',
    x: 36,
    y: 27,
  },
  {
    id: 'meeting-door',
    number: '07',
    label: 'Meeting door',
    detail: 'The lounge connection to the meeting room beyond.',
    src: '/media/floor-survey/photo_2026-09-28_10-19-18.jpg',
    x: 29,
    y: 37,
  },
] as const;

type Mode = 'video' | 'survey';

export function FloorRealityLab({ planSrc }: { planSrc: string }) {
  const [mode, setMode] = useState<Mode>('video');
  const [active, setActive] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const view = VIEWS[active]!;

  useEffect(() => {
    if (mode === 'video') void video.current?.play().catch(() => undefined);
    else video.current?.pause();
  }, [mode]);

  function choose(index: number) {
    setActive(index);
    setMode('survey');
  }

  function step(direction: -1 | 1) {
    choose((active + direction + VIEWS.length) % VIEWS.length);
  }

  return (
    <div className="fr-root" data-hub-lab={LAB_MARKER}>
      <header className="fr-bar">
        <Link href="/lab/floor" className="fr-brand">THE HUB @ LLOYDS WHARF</Link>
        <span className="fr-status">Real floor test · development only</span>
      </header>

      <main>
        <section className="fr-intro">
          <div>
            <p className="fr-eyebrow">Unit 4 · Second floor · visual survey 01</p>
            <h1>Walk the real floor.</h1>
          </div>
          <p className="fr-lede">
            The measured plan stays the source of truth. The real footage and photographs give it material, light and a
            sense of arrival. This test joins the two without pretending the photographs are a finished 3D scan.
          </p>
        </section>

        <section className="fr-explorer" aria-label="Real floor explorer">
          <div className="fr-stage">
            <div className="fr-mode" role="group" aria-label="View mode">
              <button type="button" className={mode === 'video' ? 'is-active' : ''} onClick={() => setMode('video')}>
                Walkthrough
              </button>
              <button type="button" className={mode === 'survey' ? 'is-active' : ''} onClick={() => setMode('survey')}>
                Still survey
              </button>
            </div>

            <div className={`fr-media is-${mode}`}>
              <video
                ref={video}
                className="fr-video"
                src="/media/arrive.mp4"
                poster="/media/arrive_poster.jpg"
                autoPlay
                muted
                loop
                playsInline
                controls
                aria-label="Walkthrough of the second floor"
              />
              <div className="fr-photo" aria-hidden={mode !== 'survey'}>
                <Image src={view.src} alt={view.detail} fill sizes="(max-width: 900px) 100vw, 62vw" priority />
              </div>
              <div className="fr-frame" aria-hidden="true" />
              <div className="fr-caption" aria-live="polite">
                <span>{mode === 'video' ? '00' : view.number}</span>
                <div>
                  <strong>{mode === 'video' ? 'The walkthrough' : view.label}</strong>
                  <p>{mode === 'video' ? 'The existing 11-second portrait pass through the floor.' : view.detail}</p>
                </div>
              </div>
              {mode === 'survey' && (
                <div className="fr-arrows">
                  <button type="button" onClick={() => step(-1)} aria-label="Previous viewpoint">←</button>
                  <button type="button" onClick={() => step(1)} aria-label="Next viewpoint">→</button>
                </div>
              )}
            </div>
          </div>

          <aside className="fr-plan-panel">
            <div className="fr-plan-heading">
              <div>
                <p className="fr-eyebrow">Measured reference</p>
                <h2>Where you are</h2>
              </div>
              <span>31.71 m × 18.44 m</span>
            </div>
            <div className="fr-plan">
              <Image src={planSrc} alt="Measured plan of Unit 4, Second Floor" fill sizes="(max-width: 900px) 100vw, 38vw" />
              <div className="fr-plan-points" aria-label="Provisional photographic viewpoints">
                {VIEWS.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={mode === 'survey' && index === active ? 'is-active' : ''}
                    style={{ left: `${item.x}%`, top: `${item.y}%` }}
                    onClick={() => choose(index)}
                    aria-label={`Open viewpoint ${item.number}: ${item.label}`}
                  >
                    {item.number}
                  </button>
                ))}
              </div>
            </div>
            <p className="fr-plan-note">
              Viewpoint positions are provisional. One marked-up plan or a short narrated walk will lock them to the
              correct rooms before this joins the booking map.
            </p>
          </aside>
        </section>

        <section className="fr-strip" aria-label="Photographic viewpoints">
          {VIEWS.map((item, index) => (
            <button key={item.id} type="button" className={mode === 'survey' && index === active ? 'is-active' : ''} onClick={() => choose(index)}>
              <span className="fr-thumb"><Image src={item.src} alt="" fill sizes="160px" /></span>
              <span className="fr-thumb-copy"><small>{item.number}</small><strong>{item.label}</strong></span>
            </button>
          ))}
        </section>

        <section className="fr-findings">
          <div>
            <p className="fr-eyebrow">What already works</p>
            <h2>The floor has its own visual language.</h2>
          </div>
          <ul>
            <li><span>01</span> Herringbone makes a natural route through the floor.</li>
            <li><span>02</span> Timber, brick, steel ducts and black glass frames give us the depth.</li>
            <li><span>03</span> The arched window lounge creates a destination at the end of the walk.</li>
          </ul>
          <div className="fr-next">
            <p className="fr-eyebrow">Needed for a true spatial capture</p>
            <p>
              A slow landscape loop with 70–75% overlap, an empty floor with screens off, ceiling height plus one known
              wall or doorway measurement, and confirmed camera positions on the plan.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
