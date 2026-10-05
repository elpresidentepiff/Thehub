'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import type { Floor, Space, Unit, UnitKind } from '@/commerce/inventory.ts';
import { publicUnitAccess } from './public-unit.ts';
import './booking-floor.css';

const KIND: Record<UnitKind, string> = {
  desk: 'Desk',
  meeting_room: 'Meeting room',
  private_office: 'Private office',
  event_space: 'Event space',
};

const FILTERS: { value: UnitKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All spaces' },
  { value: 'desk', label: 'Desks' },
  { value: 'meeting_room', label: 'Meeting rooms' },
  { value: 'private_office', label: 'Private offices' },
];

const DIRS: Record<string, readonly [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};

const points = (footprint: Unit['footprint']) => footprint.map(([x, y]) => `${x},${y}`).join(' ');

/** Convex outline of the ten touching centre panels, drawn as the single physical bench. */
function hull(units: readonly Unit[]) {
  const pts = units.flatMap((unit) => unit.footprint.map(([x, y]) => [x, y] as const));
  if (pts.length < 3) return pts;
  const sorted = [...pts].sort(([ax, ay], [bx, by]) => ax - bx || ay - by);
  const cross = (a: readonly number[], b: readonly number[], c: readonly number[]) =>
    (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
  const half = (input: typeof sorted) => {
    const out: typeof sorted = [];
    for (const point of input) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, point) <= 0) out.pop();
      out.push(point);
    }
    return out;
  };
  return [...half(sorted).slice(0, -1), ...half([...sorted].reverse()).slice(0, -1)];
}

function labelLines(label: string) {
  const match = /^(.*?)\s*\((.+)\)$/.exec(label);
  return match ? [match[1]!, match[2]!] : [label];
}

export interface FloorPickerProps {
  floor: Floor;
  planSrc: string;
  spaces: readonly Space[];
  units: readonly Unit[];
}

export function FloorPicker({ floor, planSrc, spaces, units }: FloorPickerProps) {
  const [filter, setFilter] = useState<UnitKind | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState(units[0]?.id ?? '');
  const unitEls = useRef(new Map<string, SVGGElement>());
  const shown = units.filter((unit) => filter === 'all' || unit.kind === filter);
  const selectable = shown.filter((unit) => publicUnitAccess(unit) === 'selectable');
  const selected = selectedId ? units.find((unit) => unit.id === selectedId) : undefined;
  const tabStop = selectable.some((unit) => unit.id === focusId) ? focusId : selectable[0]?.id;
  const desks = units.filter((unit) => unit.kind === 'desk');
  const wallBanks = [desks.slice(0, 3), desks.slice(3, 6), desks.slice(6, 9)];
  const centreBench = desks.slice(9, 19);

  function choose(id: string) {
    setSelectedId(id);
    setFocusId(id);
  }

  function neighbour(fromId: string, [dx, dy]: readonly [number, number]) {
    const from = units.find((unit) => unit.id === fromId);
    if (!from) return selectable[0]?.id;
    let best: { id: string; score: number } | undefined;
    for (const unit of selectable) {
      const vx = unit.x - from.x;
      const vy = unit.y - from.y;
      const along = vx * dx + vy * dy;
      const across = Math.abs(vx * dy - vy * dx);
      if (unit.id === fromId || along <= 0.05 || across > along) continue;
      const score = along + 2 * across;
      if (!best || score < best.score) best = { id: unit.id, score };
    }
    return best?.id;
  }

  function onMapKey(event: KeyboardEvent<SVGGElement>, fromId: string) {
    const direction = DIRS[event.key];
    let next = direction ? neighbour(fromId, direction) : undefined;
    if (event.key === 'Home') next = selectable[0]?.id;
    if (event.key === 'End') next = selectable[selectable.length - 1]?.id;
    if (event.key === 'Enter' || event.key === ' ') next = fromId;
    if (!direction && !['Home', 'End', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (!next) return;
    unitEls.current.get(next)?.focus();
    choose(next);
  }

  return (
    <div className="bf-shell">
      <div className="bf-toolbar">
        <p id="floor-instruction">Choose on the plan or use the complete list below.</p>
        <div className="bf-filters" role="group" aria-label="Filter spaces">
          {FILTERS.map((item) => (
            <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bf-plan-frame">
        <div className="bf-plan" style={{ aspectRatio: `${floor.width} / ${floor.height}` }}>
          <img src={planSrc} alt="" draggable={false} />
          <svg viewBox={`0 0 ${floor.width} ${floor.height}`} role="radiogroup" aria-describedby="floor-instruction" aria-label={`${floor.name} plan`}>
            {spaces.filter((space) => space.footprint).map((space) => {
              const fp = space.footprint!;
              const cx = fp.reduce((total, point) => total + point[0], 0) / fp.length;
              const cy = fp.reduce((total, point) => total + point[1], 0) / fp.length;
              return (
                <g key={space.id} className={`bf-space is-${space.kind}`} aria-hidden="true">
                  <polygon points={points(fp)} />
                  <text x={cx} y={cy}>{space.name}</text>
                </g>
              );
            })}
            <g className="bf-furniture" aria-hidden="true">
              {wallBanks.map((bank, index) => (
                <g key={index}>
                  {bank.map((unit) => <polygon key={unit.id} className="bf-wall-table" points={points(unit.footprint)} />)}
                </g>
              ))}
              <polygon className="bf-centre-table" points={points(hull(centreBench))} />
              {centreBench.map((unit) => <polygon key={unit.id} className="bf-centre-seam" points={points(unit.footprint)} />)}
            </g>
            {units.map((unit) => {
              const inFilter = filter === 'all' || unit.kind === filter;
              const canSelect = inFilter && publicUnitAccess(unit) === 'selectable';
              const deskNumber = unit.kind === 'desk' ? Number(unit.id.slice(-3)) : 0;
              const wallPosition = (deskNumber - 1) % 3;
              const chairRotation = deskNumber <= 9 ? -9 : unit.rotDeg;
              const chairTransform = deskNumber <= 9
                ? wallPosition === 0
                  ? 'translate(-.7 0) rotate(90)'
                  : wallPosition === 1
                    ? 'translate(.7 0) rotate(-90)'
                    : 'translate(0 .7)'
                : `translate(0 ${((deskNumber - 10) % 2 === 0 ? -1 : 1) * .69}) scale(1 ${((deskNumber - 10) % 2 === 0 ? -1 : 1)})`;
              return (
                <g
                  key={unit.id}
                  ref={(element) => {
                    if (element) unitEls.current.set(unit.id, element);
                    else unitEls.current.delete(unit.id);
                  }}
                  className={`bf-unit is-${unit.kind}${selectedId === unit.id ? ' is-selected' : ''}${inFilter ? '' : ' is-dim'}${canSelect ? '' : ' is-disabled'}`}
                  role={canSelect ? 'radio' : undefined}
                  aria-checked={canSelect ? selectedId === unit.id : undefined}
                  aria-label={canSelect ? `${unit.label}, ${KIND[unit.kind].toLowerCase()}` : undefined}
                  aria-hidden={canSelect ? undefined : true}
                  tabIndex={canSelect ? (tabStop === unit.id ? 0 : -1) : undefined}
                  onClick={canSelect ? () => choose(unit.id) : undefined}
                  onKeyDown={canSelect ? (event) => onMapKey(event, unit.id) : undefined}
                >
                  <polygon className="bf-ring" points={points(unit.footprint)} vectorEffect="non-scaling-stroke" />
                  <polygon className="bf-shape" points={points(unit.footprint)} vectorEffect="non-scaling-stroke" />
                  {unit.kind === 'desk' ? (
                    <g className="bf-chair" transform={`translate(${unit.x} ${unit.y}) rotate(${chairRotation}) ${chairTransform}`} aria-hidden="true">
                      <circle cx="0" cy=".04" r=".37" />
                      <rect x="-.25" y="-.16" width=".5" height=".34" rx=".08" />
                      <path d="M-.32 .13 Q0 .38 .32 .13M0 .17V.39M0 .33L-.28 .46M0 .33L.28 .46M0 .33L-.32 .28M0 .33L.32 .28" />
                    </g>
                  ) : (
                    <text x={unit.x} y={unit.y}>
                      {labelLines(unit.label).map((line, index, all) => (
                        <tspan key={line} x={unit.x} dy={index ? '1.2em' : `${-0.6 * (all.length - 1)}em`}>{line}</tspan>
                      ))}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <aside className="bf-choice" aria-live="polite">
        {selected ? (
          <>
            <p>{KIND[selected.kind]} · {selected.id}</p>
            <h2>{selected.label}</h2>
            <dl>
              <div><dt>Capacity</dt><dd>{selected.capacity} {selected.capacity === 1 ? 'person' : 'people'}</dd></div>
              <div><dt>Status</dt><dd>Online booking is being connected</dd></div>
            </dl>
            <button type="button" disabled>Online booking is being connected</button>
            <p className="bf-honest">We will only take a booking once live availability and secure payment are connected.</p>
          </>
        ) : (
          <>
            <p>Choose your space</p>
            <h2>Select a desk, room or office.</h2>
            <span>The plan is ready to explore. Online booking is being connected.</span>
          </>
        )}
      </aside>

      <section className="bf-list" aria-labelledby="bf-list-title">
        <h2 id="bf-list-title">Every place on this floor</h2>
        {spaces.map((space) => {
          const inSpace = shown.filter((unit) => unit.spaceId === space.id);
          if (!inSpace.length) return null;
          return (
            <div key={space.id} className="bf-group">
              <h3>{space.name}</h3>
              <ul>
                {inSpace.map((unit) => {
                  const canSelect = publicUnitAccess(unit) === 'selectable';
                  return (
                    <li key={unit.id}>
                      {canSelect ? (
                        <button type="button" aria-pressed={selectedId === unit.id} onClick={() => choose(unit.id)}>
                          <strong>{unit.label}</strong>
                          <span>{KIND[unit.kind]} · {unit.capacity} {unit.capacity === 1 ? 'person' : 'people'}</span>
                          <small>View space</small>
                        </button>
                      ) : (
                        <div className="bf-list-disabled">
                          <strong>{unit.label}</strong>
                          <span>{KIND[unit.kind]} · Not available to book online</span>
                          <small>Contact us</small>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}
