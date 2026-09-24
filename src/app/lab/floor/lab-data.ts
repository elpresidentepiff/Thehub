/**
 * Server-side data for the floor lab: the real registry, the development catalogue and the
 * London calendar. Development only: page.tsx 404s anywhere else, the actions assert it, and
 * the mock availability provider throws outside development.
 */
import registryJson from '../../../../data/inventory/unit4-l2.json';
import { catalogueFor, formatMoney, formatPrice, offersFor } from '@/commerce/catalogue.ts';
import { hubEnvironment } from '@/commerce/env.ts';
import { parseRegistry } from '@/commerce/inventory.ts';
import { dayPeriod, londonTime, londonWallClock, type Period } from '@/commerce/period.ts';

export const registry = parseRegistry(registryJson);
export const catalogue = () => catalogueFor(hubEnvironment());

/** One desk the mock shows as already yours, so the "your booking" state can be reviewed. */
export const LAB_YOURS: readonly string[] = ['L2-D006'];

export interface PeriodInput {
  date: string;
  from: string;
  until: string;
}

export function periodFrom(input: PeriodInput): Period | null {
  if (typeof input?.date !== 'string' || typeof input.from !== 'string' || typeof input.until !== 'string') return null;
  try {
    return { start: londonTime(input.date, input.from), end: londonTime(input.date, input.until) };
  } catch {
    return null;
  }
}

const noon = (date: string) => new Date(`${date}T12:00:00Z`);
const addDays = (date: string, n: number) => new Date(noon(date).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const dayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export interface LabDay {
  date: string;
  label: string;
  /** A whole-day booking is still possible (the day has not started, bar the slot in progress). */
  wholeDayOpen: boolean;
}

/** The next open days in London, starting today if the floor has not closed yet. */
export function upcomingDays(now: Date, count = 10): LabDay[] {
  const { rules } = catalogue();
  const days: LabDay[] = [];
  for (let date = londonWallClock(now).date; days.length < count; date = addDays(date, 1)) {
    const weekday = noon(date).getUTCDay() || 7;
    if (!rules.openDays.includes(weekday)) continue;
    const day = dayPeriod(date, rules);
    if (day.end <= now) continue;
    const wholeDayOpen = day.start.getTime() >= now.getTime() - rules.slotMinutes * 60_000;
    days.push({ date, label: dayLabel.format(noon(date)), wholeDayOpen });
  }
  return days;
}

export function timeSlots(): string[] {
  const { rules } = catalogue();
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const pad = (n: number) => String(n).padStart(2, '0');
  const out: string[] = [];
  for (let m = mins(rules.opens); m <= mins(rules.closes); m += rules.slotMinutes) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  return out;
}

export interface OfferSummary {
  label: string;
  price: string;
  basis: 'Book online' | 'Monthly membership' | 'By enquiry';
}

/** Display text only. Amounts for a booking always come back from quoteUnit on the server. */
export function offerSummaries(): Record<string, OfferSummary[]> {
  const cat = catalogue();
  const basis = { one_time: 'Book online', recurring: 'Monthly membership', enquiry: 'By enquiry' } as const;
  return Object.fromEntries(
    registry.units.map((u) => [u.id, offersFor(u, cat).map((o) => ({ label: o.label, price: formatPrice(o), basis: basis[o.billing] }))]),
  );
}

export function addOnSummaries(): { id: string; label: string; price: string; unitKinds: readonly string[] }[] {
  return catalogue().addOns.map((a) => ({ id: a.id, label: a.label, price: formatMoney(a.unitAmount), unitKinds: a.unitKinds }));
}
