import { londonTime, type Period } from './period.ts';

export interface PeriodInput { date: string; from: string; until: string; }
export interface AvailabilityInput extends PeriodInput { floorId: string; }
export interface HoldInput extends PeriodInput { unitId: string; productId: string; }
export interface ReleaseInput { reservationId: string; }

const FLOOR_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UNIT_ID = /^L[0-9]+-(?:D[0-9]{3}|MR[0-9]{2}|OFFICE[0-9]{2}|EVENT[0-9]{2})$/;
const PRODUCT_ID = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (input: unknown): Record<string, unknown> | null => typeof input === 'object' && input !== null && !Array.isArray(input) ? input as Record<string, unknown> : null;
const text = (record: Record<string, unknown>, key: string, max: number): string | null => {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
};

export function periodFrom(input: PeriodInput): Period | null {
  if (typeof input?.date !== 'string' || typeof input.from !== 'string' || typeof input.until !== 'string') return null;
  try {
    const period = { start: londonTime(input.date, input.from), end: londonTime(input.date, input.until) };
    return period.end > period.start ? period : null;
  } catch { return null; }
}

function periodInput(record: Record<string, unknown>): PeriodInput | null {
  const date = text(record, 'date', 10), from = text(record, 'from', 5), until = text(record, 'until', 5);
  if (!date || !from || !until) return null;
  const value = { date, from, until };
  return periodFrom(value) ? value : null;
}

export function parseAvailabilityInput(input: unknown): AvailabilityInput | null {
  const record = object(input);
  if (!record) return null;
  const period = periodInput(record), floorId = text(record, 'floorId', 80);
  return period && floorId && FLOOR_ID.test(floorId) ? { ...period, floorId } : null;
}

export function parseHoldInput(input: unknown): HoldInput | null {
  const record = object(input);
  if (!record) return null;
  const period = periodInput(record), unitId = text(record, 'unitId', 40), productId = text(record, 'productId', 80);
  return period && unitId && productId && UNIT_ID.test(unitId) && PRODUCT_ID.test(productId) ? { ...period, unitId, productId } : null;
}

export function parseReleaseInput(input: unknown): ReleaseInput | null {
  const record = object(input);
  if (!record) return null;
  const reservationId = text(record, 'reservationId', 36);
  return reservationId && UUID.test(reservationId) ? { reservationId } : null;
}
