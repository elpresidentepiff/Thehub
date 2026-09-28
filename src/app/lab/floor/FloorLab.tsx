'use client';
/**
 * The floor lab. The plan is an image (scenery, never clickable); the units are a separate
 * SVG layer in the same metric coordinates, drawn from the registry. The map is one tab stop
 * (a radio group: arrow keys move spatially, selection follows focus) and the list below
 * carries the same inventory for touch and screen readers.
 */
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import type { UnitState } from '@/commerce/availability.ts';
import type { Floor, Space, Unit, UnitKind } from '@/commerce/inventory.ts';
import { floorStates, quoteUnit, type FloorView, type QuoteView } from './actions.ts';
import type { LabDay, OfferSummary, PeriodInput } from './lab-data.ts';
import './floor.css';

const LAB_MARKER = '__HUB_LAB__'; // scripts/check-bundle.mjs fails the build if this reaches /

const KIND: Record<UnitKind, string> = {
  desk: 'Desk',
  meeting_room: 'Meeting room',
  private_office: 'Private office',
  event_space: 'Event space',
};

const STATE_WORD: Record<UnitState, string> = {
  available: 'Free',
  held: 'Being booked',
  unavailable: 'Taken',
  closed: 'Closed',
  not_bookable: 'Not bookable',
  yours: 'Yours',
};

const STATE_SENTENCE: Record<UnitState, string> = {
  available: 'Free for this time.',
  held: 'Someone is paying for this right now. It may come free in a few minutes.',
  unavailable: 'Booked for this time.',
  closed: 'The floor is closed then.',
  not_bookable: 'Not offered for booking.',
  yours: 'You have this booked for this time.',
};

const FILTERS: { value: UnitKind | 'all'; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'desk', label: 'Desks' },
  { value: 'meeting_room', label: 'Meeting rooms' },
  { value: 'private_office', label: 'Offices' },
];

const LEGEND: UnitState[] = ['available', 'held', 'unavailable', 'yours', 'not_bookable'];

const DIRS: Record<string, readonly [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };

const points = (fp: Unit['footprint']) => fp.map(([x, y]) => `${x},${y}`).join(' ');

/** "Meeting room (small)" → two lines, so a label fits inside its room on the plan. */
const labelLines = (label: string) => {
  const m = /^(.*?)\s*\((.+)\)$/.exec(label);
  return m ? [m[1]!, m[2]!] : [label];
};

export interface FloorLabProps {
  planSrc: string;
  floor: Floor;
  registryStatus: string;
  spaces: readonly Space[];
  units: readonly Unit[];
  offers: Record<string, OfferSummary[]>;
  addOns: { id: string; label: string; price: string; unitKinds: readonly string[] }[];
  days: LabDay[];
  slots: string[];
  initialPeriod: PeriodInput;
  initialView: FloorView;
}

export function FloorLab(props: FloorLabProps) {
  const { floor, units, spaces, days, slots } = props;
  const opens = slots[0]!;
  const closes = slots[slots.length - 1]!;

  const [period, setPeriod] = useState(props.initialPeriod);
  const [view, setView] = useState(props.initialView);
  const [kind, setKind] = useState<UnitKind | 'all'>('all');
  const [materialView, setMaterialView] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState(units[0]?.id ?? '');
  const [addOns, setAddOns] = useState<string[]>([]);
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [pending, startTransition] = useTransition();
  const request = useRef(0);
  const unitEls = useRef(new Map<string, SVGGElement>());
  const scroller = useRef<HTMLDivElement>(null);

  const wholeDay = period.from === opens && period.until === closes;
  const selected = selectedId ? units.find((u) => u.id === selectedId) : undefined;
  const navigable = units.filter((u) => kind === 'all' || u.kind === kind);
  const stateOf = (id: string): UnitState => view.states[id] ?? 'closed';

  // On a narrow screen the plan pans; start over the main office rather than the empty west end.
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (18 / floor.width) * el.scrollWidth - el.clientWidth / 2;
  }, [floor.width]);

  /** Ask the server again. Only the latest answer is applied, so fast changes never race. */
  function refresh(next: { period?: PeriodInput; unitId?: string | null; addOns?: string[] }) {
    const p = next.period ?? period;
    const id = next.unitId !== undefined ? next.unitId : selectedId;
    const extras = next.addOns ?? addOns;
    const n = ++request.current;
    startTransition(async () => {
      const [v, q] = await Promise.all([
        next.period ? floorStates(p) : null,
        id ? quoteUnit({ ...p, unitId: id, addOns: extras }) : null,
      ]);
      if (n !== request.current) return;
      if (v) setView(v);
      setQuote(q);
    });
  }

  function changePeriod(p: PeriodInput) {
    setPeriod(p);
    refresh({ period: p });
  }

  function choose(id: string) {
    const unit = units.find((u) => u.id === id);
    const kept = addOns.filter((a) => unit && props.addOns.find((x) => x.id === a)?.unitKinds.includes(unit.kind));
    setSelectedId(id);
    setFocusId(id);
    setAddOns(kept);
    refresh({ unitId: id, addOns: kept });
  }

  function toggleAddOn(id: string) {
    const next = addOns.includes(id) ? addOns.filter((a) => a !== id) : [...addOns, id];
    setAddOns(next);
    refresh({ addOns: next });
  }

  /** Nearest unit in the arrow's direction, favouring ones straight ahead over ones off to the side. */
  function neighbour(fromId: string, [dx, dy]: readonly [number, number]): string | undefined {
    const from = units.find((u) => u.id === fromId);
    if (!from) return navigable[0]?.id;
    let best: { id: string; score: number } | undefined;
    for (const u of navigable) {
      const vx = u.x - from.x;
      const vy = u.y - from.y;
      const along = vx * dx + vy * dy;
      const across = Math.abs(vx * dy - vy * dx);
      // Only within 45° of the arrow: the plan's grid is rotated 9°, and a desk pair must not
      // read as "up" from its neighbour.
      if (u.id === fromId || along <= 0.05 || across > along) continue;
      const score = along + 2 * across;
      if (!best || score < best.score) best = { id: u.id, score };
    }
    return best?.id;
  }

  function onMapKey(e: KeyboardEvent<SVGGElement>, fromId: string) {
    let next: string | undefined;
    const dir = DIRS[e.key];
    if (dir) next = neighbour(fromId, dir);
    else if (e.key === 'Home') next = navigable[0]?.id;
    else if (e.key === 'End') next = navigable[navigable.length - 1]?.id;
    else if (e.key === 'Enter' || e.key === ' ') next = fromId;
    else return;
    e.preventDefault();
    if (!next) return;
    unitEls.current.get(next)?.focus();
    choose(next);
  }

  // Keep the map's single tab stop on a unit that is still in the filter.
  const tabStop = navigable.some((u) => u.id === focusId) ? focusId : navigable[0]?.id;
  const dayLabel = days.find((d) => d.date === period.date)?.label ?? period.date;
  const unitAddOns = selected ? props.addOns.filter((a) => a.unitKinds.includes(selected.kind)) : [];
  const selectedState = selected ? stateOf(selected.id) : undefined;

  return (
    <div className="fl-root" data-hub-lab={LAB_MARKER}>
      <header className="fl-bar">
        <span className="fl-brand">THE HUB @ LLOYDS WHARF</span>
        <span className="fl-mock">Mock availability · development only</span>
      </header>

      <main className="fl-wrap">
        <p className="fl-eyebrow">Floor lab · {floor.name}</p>
        <h1 className="fl-title">Choose your place.</h1>
        <p className="fl-lede">
          The architect&rsquo;s drawing is the scenery. Every desk and room on it is a record with a stable ID, and what it
          costs and whether it is free come from the commerce engine for the time you pick.
        </p>
        {props.registryStatus && <p className="fl-draft">{props.registryStatus}</p>}

        <form className="fl-controls" onSubmit={(e) => e.preventDefault()} aria-label="When">
          <label className="fl-field">
            Day
            <select value={period.date} onChange={(e) => changePeriod({ ...period, date: e.target.value })}>
              {days.map((d) => (
                <option key={d.date} value={d.date}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="fl-check">
            <input
              type="checkbox"
              checked={wholeDay}
              onChange={(e) => changePeriod({ ...period, ...(e.target.checked ? { from: opens, until: closes } : { from: '10:00', until: '12:00' }) })}
            />
            Whole day
          </label>
          <label className="fl-field">
            From
            <select value={period.from} disabled={wholeDay} onChange={(e) => {
              const from = e.target.value;
              changePeriod({ ...period, from, until: period.until > from ? period.until : slots[slots.indexOf(from) + 1] ?? closes });
            }}>
              {slots.slice(0, -1).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="fl-field">
            Until
            <select value={period.until} disabled={wholeDay} onChange={(e) => changePeriod({ ...period, until: e.target.value })}>
              {slots.filter((t) => t > period.from).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <div className="fl-filters" role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <button key={f.value} type="button" className="fl-chip" aria-pressed={kind === f.value} onClick={() => setKind(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
        </form>
        {view.notice && <p className="fl-notice" role="status">{view.notice}</p>}

        <div className="fl-grid">
          <div className="fl-main">
            <div className="fl-planbar">
              <div>
                <span className="fl-planbar-kicker">The real floor</span>
                <strong>Photo-material plan</strong>
              </div>
              <div className="fl-view-switch" role="group" aria-label="Plan appearance">
                <button type="button" aria-pressed={materialView} onClick={() => setMaterialView(true)}>
                  Materials
                </button>
                <button type="button" aria-pressed={!materialView} onClick={() => setMaterialView(false)}>
                  Drawing
                </button>
              </div>
            </div>
            <div className="fl-mapscroll" ref={scroller}>
              <div
                className={`fl-map ${materialView ? 'is-material' : 'is-drawing'}`}
                style={{ aspectRatio: `${floor.width} / ${floor.height}` }}
                aria-busy={pending}
              >
                <img className="fl-plan" src={props.planSrc} alt="" draggable={false} />
                <svg
                  className="fl-overlay"
                  viewBox={`0 0 ${floor.width} ${floor.height}`}
                  role="radiogroup"
                  aria-label={`${floor.name} plan. Arrow keys move between places.`}
                >
                  <defs>
                    <linearGradient id="fl-glass" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="var(--hub-plaster)" stopOpacity=".82" />
                      <stop offset=".42" stopColor="var(--hub-daylight)" stopOpacity=".48" />
                      <stop offset=".46" stopColor="var(--hub-plaster)" stopOpacity=".66" />
                      <stop offset="1" stopColor="var(--hub-daylight)" stopOpacity=".28" />
                    </linearGradient>
                    <pattern id="fl-panel-photo" width="2.8" height="2.8" patternUnits="userSpaceOnUse">
                      <image href="/lab/floor-materials/black-ribbed-wall.webp" width="2.8" height="2.8" preserveAspectRatio="xMidYMid slice" />
                    </pattern>
                  </defs>
                  {spaces
                    .filter((s) => s.footprint)
                    .map((s) => {
                      const fp = s.footprint!;
                      const cx = fp.reduce((t, p) => t + p[0], 0) / fp.length;
                      const cy = fp.reduce((t, p) => t + p[1], 0) / fp.length;
                      return (
                        <g key={s.id} className={`fl-space is-${s.id.toLowerCase()}`} aria-hidden="true">
                          <polygon points={points(fp)} />
                          <text x={cx} y={cy}>{s.name}</text>
                        </g>
                      );
                    })}
                  {units.map((u) => {
                    const state = stateOf(u.id);
                    const inFilter = kind === 'all' || u.kind === kind;
                    const deskNumber = u.kind === 'desk' ? Number(u.id.slice(-3)) : 0;
                    const chairSide = deskNumber >= 10 && (deskNumber - 10) % 2 === 0 ? -1 : 1;
                    return (
                      <g
                        key={u.id}
                        ref={(el) => {
                          if (el) unitEls.current.set(u.id, el);
                          else unitEls.current.delete(u.id);
                        }}
                        className={`fl-unit is-${u.kind} is-${state}${u.id === selectedId ? ' is-selected' : ''}${inFilter ? '' : ' is-dim'}`}
                        role={inFilter ? 'radio' : undefined}
                        aria-checked={inFilter ? u.id === selectedId : undefined}
                        aria-label={inFilter ? `${u.label}, ${KIND[u.kind].toLowerCase()}, ${STATE_WORD[state].toLowerCase()}` : undefined}
                        aria-hidden={inFilter ? undefined : true}
                        tabIndex={inFilter ? (u.id === tabStop ? 0 : -1) : undefined}
                        onClick={inFilter ? () => choose(u.id) : undefined}
                        onKeyDown={inFilter ? (e) => onMapKey(e, u.id) : undefined}
                      >
                        <polygon className="fl-ring" points={points(u.footprint)} vectorEffect="non-scaling-stroke" />
                        <polygon className="fl-shape" points={points(u.footprint)} vectorEffect="non-scaling-stroke" />
                        {u.kind === 'desk' && (
                          <g className="fl-furniture" transform={`translate(${u.x} ${u.y}) rotate(${u.rotDeg})`} aria-hidden="true">
                            <g className="fl-chair" transform={`translate(0 ${chairSide * .66}) scale(1 ${chairSide})`}>
                              <rect className="fl-chair-seat" x="-.2" y="-.15" width=".4" height=".32" rx=".07" />
                              <path className="fl-chair-back" d="M-.27 .12 Q0 .3 .27 .12" />
                              <path className="fl-chair-arms" d="M-.2 -.05L-.3 .03M.2 -.05L.3 .03" />
                              <path className="fl-chair-base" d="M0 .13V.35M0 .3L-.22 .41M0 .3L.22 .41M0 .3L-.3 .27M0 .3L.3 .27" />
                            </g>
                            <path className="fl-desk-legs" d="M-.48 -.24V.24M.48 -.24V.24" />
                            <circle className="fl-grommet" cx=".44" cy="0" r=".07" />
                          </g>
                        )}
                        <circle className="fl-status-dot" cx={u.x} cy={u.y} r=".1" vectorEffect="non-scaling-stroke" />
                        {u.kind !== 'desk' && (
                          <text x={u.x} y={u.y}>
                            {labelLines(u.label).map((line, i, all) => (
                              <tspan key={line} x={u.x} dy={i ? '1.2em' : `${-0.6 * (all.length - 1)}em`}>
                                {line}
                              </tspan>
                            ))}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            <ul className="fl-legend" aria-label="Key">
              {LEGEND.map((s) => (
                <li key={s}>
                  <svg viewBox="0 0 22 14" aria-hidden="true">
                    <g className={`fl-unit is-${s}`}>
                      <polygon className="fl-shape" points="1.5,1.5 20.5,1.5 20.5,12.5 1.5,12.5" />
                    </g>
                  </svg>
                  {STATE_WORD[s]}
                </li>
              ))}
            </ul>

            <section className="fl-list" aria-labelledby="fl-list-heading">
              <h2 id="fl-list-heading" className="fl-section">Every place on this floor</h2>
              {spaces.map((space) => {
                const inSpace = navigable.filter((u) => u.spaceId === space.id);
                if (!inSpace.length) return null;
                return (
                  <div key={space.id} className="fl-group">
                    <h3>{space.name}</h3>
                    <ul>
                      {inSpace.map((u) => {
                        const state = stateOf(u.id);
                        return (
                          <li key={u.id}>
                            <button type="button" className="fl-item" aria-pressed={u.id === selectedId} onClick={() => choose(u.id)}>
                              <span className="fl-item-name">{u.label}</span>
                              <span className="fl-item-meta">
                                {KIND[u.kind]} · {u.capacity} {u.capacity === 1 ? 'seat' : 'seats'} · {u.id}
                              </span>
                              <span className={`fl-item-state is-${state}`}>{STATE_WORD[state]}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </section>
          </div>

          <aside className={`fl-detail${selected ? '' : ' is-empty'}`} aria-live="polite" aria-busy={pending}>
            {!selected || !selectedState ? (
              <>
                <p className="fl-tag">Nothing chosen yet</p>
                <h2>Pick a desk or a room.</h2>
                <p className="fl-muted">On the plan or in the list. Whether it is free, and the price, come back from the server for {dayLabel}.</p>
              </>
            ) : (
              <>
                <p className="fl-tag">
                  {KIND[selected.kind]} · {selected.id}
                </p>
                <h2>{selected.label}</h2>
                <p className={`fl-state is-${selectedState}`}>{STATE_SENTENCE[selectedState]}</p>
                <dl className="fl-facts">
                  <div>
                    <dt>Seats</dt>
                    <dd>{selected.capacity}</dd>
                  </div>
                  <div>
                    <dt>When</dt>
                    <dd>
                      {dayLabel}, {period.from}–{period.until}
                    </dd>
                  </div>
                </dl>
                {selected.note && <p className="fl-note">{selected.note}</p>}

                {(props.offers[selected.id] ?? []).length > 0 && (
                  <ul className="fl-offers">
                    {props.offers[selected.id]!.map((o) => (
                      <li key={o.label + o.basis}>
                        <span>
                          {o.label}
                          <small>{o.basis}</small>
                        </span>
                        <b>{o.price}</b>
                      </li>
                    ))}
                  </ul>
                )}

                {unitAddOns.length > 0 && (
                  <fieldset className="fl-addons">
                    <legend>Extras</legend>
                    {unitAddOns.map((a) => (
                      <label key={a.id}>
                        <input type="checkbox" checked={addOns.includes(a.id)} onChange={() => toggleAddOn(a.id)} />
                        <span>{a.label}</span>
                        <b>{a.price}</b>
                      </label>
                    ))}
                  </fieldset>
                )}

                {quote?.ok ? (
                  <table className="fl-quote">
                    <caption>Your price</caption>
                    <tbody>
                      {quote.lines.map((l) => (
                        <tr key={l.label}>
                          <th scope="row">
                            {l.label}
                            {l.detail && <small>{l.detail}</small>}
                          </th>
                          <td>{l.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">Total</th>
                        <td>{quote.total}</td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  // not_bookable is already said above; the engine's refusal would only repeat it
                  quote && selectedState !== 'not_bookable' && <p className="fl-refusal">{quote.message}</p>
                )}

                <button type="button" className="fl-btn" disabled>
                  Hold this place
                </button>
                <p className="fl-small">
                  Holding and paying switch on with the Hub database and Stripe test mode, after approval (ROADMAP C2).
                </p>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
