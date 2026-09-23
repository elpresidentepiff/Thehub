/**
 * Availability as the floor picker sees it: one state per unit for a period, never who holds
 * or booked it. The database provider (C2) reads private.unit_availability; the mock below
 * invents a believable, repeatable floor for the dev lab and refuses to exist anywhere but a
 * developer's machine.
 *
 * Precedence matches the database: not_bookable > closed > yours > unavailable > held > available.
 */
import type { Catalogue } from './catalogue.ts';
import { assertDevelopment } from './env.ts';
import type { Registry } from './inventory.ts';
import type { Period } from './period.ts';
import { dayPeriod, londonWallClock } from './period.ts';

export type UnitState = 'available' | 'held' | 'unavailable' | 'closed' | 'not_bookable' | 'yours';

export interface AvailabilityProvider {
  readonly source: 'mock' | 'database';
  unitStates(period: Period): Promise<ReadonlyMap<string, UnitState>>;
}

/** FNV-1a: the same unit on the same morning always looks the same, so the lab is reproducible. */
function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0) / 2 ** 32;
}

export function mockAvailability(
  registry: Registry,
  catalogue: Catalogue,
  opts: { env?: Record<string, string | undefined>; yours?: readonly string[] } = {},
): AvailabilityProvider {
  assertDevelopment('Mock availability', opts.env);
  const yours = new Set(opts.yours ?? []);
  const { rules } = catalogue;

  return {
    source: 'mock',
    async unitStates(period) {
      assertDevelopment('Mock availability', opts.env);
      const a = londonWallClock(period.start);
      const day = dayPeriod(a.date, rules);
      const closed = !rules.openDays.includes(a.weekday) || period.start < day.start || period.end > day.end;

      const states = new Map<string, UnitState>();
      for (const unit of registry.units) {
        let state: UnitState;
        if (!unit.bookable || unit.retired) state = 'not_bookable';
        else if (closed) state = 'closed';
        else if (yours.has(unit.id)) state = 'yours';
        else {
          const r = hash01(`${unit.id}|${a.date}|${a.minutes}`);
          state = r < 0.6 ? 'available' : r < 0.72 ? 'held' : 'unavailable';
        }
        states.set(unit.id, state);
      }
      return states;
    },
  };
}
