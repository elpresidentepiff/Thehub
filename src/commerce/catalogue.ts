/**
 * What is sold, for how much, under which rules.
 *
 * DEVELOPMENT VALUES ONLY. Real prices, VAT treatment, opening hours, durations and buffers
 * are operator decisions (docs/plan/ROADMAP.md D7–D10). They live in this one file so that
 * nothing else in the codebase embeds a price, and so that production cannot start without
 * an approved catalogue: catalogueFor('production') throws until one is written.
 */
import type { HubEnvironment } from './env.ts';
import type { UnitKind } from './inventory.ts';
import type { BookingRules } from './period.ts';

export type Billing = 'one_time' | 'recurring' | 'enquiry';

export interface Offer {
  productId: string;
  label: string;
  unitKind: UnitKind;
  /** Restrict to particular units (a room-specific rate). Omitted = every unit of the kind. */
  unitIds?: readonly string[];
  billing: Billing;
  /** Minor units (pence) per displayUnit. null for enquiry-only. */
  unitAmount: number | null;
  displayUnit: 'day' | 'hour' | 'month' | null;
  /** One-time offers charged by time: minutes per Stripe line-item quantity. */
  blockMinutes?: number;
  /** One-time offers sold as the whole opening day. */
  wholeDay?: boolean;
  minMinutes?: number;
  maxMinutes?: number;
}

export interface AddOn {
  id: string;
  label: string;
  unitKinds: readonly UnitKind[];
  unitAmount: number; // pence, per booking
  maxQuantity: number;
}

export interface Catalogue {
  environment: HubEnvironment;
  currency: 'gbp';
  rules: BookingRules;
  /** How long a unit is held before Checkout opens (D8). Checkout then stretches it. */
  holdMinutes: number;
  offers: readonly Offer[];
  addOns: readonly AddOn[];
}

export const DEVELOPMENT_CATALOGUE: Catalogue = {
  environment: 'development',
  currency: 'gbp',
  rules: {
    openDays: [1, 2, 3, 4, 5], // Mon–Fri (D9)
    opens: '08:00',
    closes: '19:00',
    slotMinutes: 30,
    maxAdvanceDays: 90,
  },
  holdMinutes: 10, // D8
  offers: [
    { productId: 'desk_day_pass', label: 'Day pass', unitKind: 'desk', billing: 'one_time', unitAmount: 3500, displayUnit: 'day', wholeDay: true },
    { productId: 'dedicated_desk_monthly', label: 'Dedicated desk', unitKind: 'desk', billing: 'recurring', unitAmount: 39500, displayUnit: 'month' },
    {
      productId: 'meeting_room_small_hire', label: 'Room hire', unitKind: 'meeting_room', unitIds: ['L2-MR01'],
      billing: 'one_time', unitAmount: 3800, displayUnit: 'hour', blockMinutes: 30, minMinutes: 60, maxMinutes: 480,
    },
    {
      productId: 'meeting_room_large_hire', label: 'Room hire', unitKind: 'meeting_room', unitIds: ['L2-MR02'],
      billing: 'one_time', unitAmount: 5500, displayUnit: 'hour', blockMinutes: 30, minMinutes: 60, maxMinutes: 480,
    },
    { productId: 'private_office_enquiry', label: 'Private office', unitKind: 'private_office', billing: 'enquiry', unitAmount: null, displayUnit: null },
    { productId: 'event_enquiry', label: 'Event hire', unitKind: 'event_space', billing: 'enquiry', unitAmount: null, displayUnit: null },
  ],
  addOns: [
    { id: 'monitor', label: 'Second monitor', unitKinds: ['desk'], unitAmount: 1200, maxQuantity: 1 },
    { id: 'room_refreshments', label: 'Tea, coffee and water for the room', unitKinds: ['meeting_room'], unitAmount: 1500, maxQuantity: 1 },
  ],
};

export function catalogueFor(environment: HubEnvironment): Catalogue {
  if (environment === 'production') {
    throw new Error('No approved production catalogue yet (ROADMAP D7). Refusing to sell at development prices.');
  }
  return { ...DEVELOPMENT_CATALOGUE, environment };
}

export function offersFor(unit: { id: string; kind: UnitKind }, catalogue: Catalogue): Offer[] {
  return catalogue.offers.filter((o) => o.unitKind === unit.kind && (!o.unitIds || o.unitIds.includes(unit.id)));
}

/** "£35", "£19.50", "£1,250". Pence in, display text out; never parsed back into an amount. */
export function formatMoney(pence: number): string {
  const pounds = pence / 100;
  return `£${pounds.toLocaleString('en-GB', { minimumFractionDigits: pence % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** "£35 / day", "£38 / hour", "Enquire". For display only; never sent back as an amount. */
export function formatPrice(offer: Offer): string {
  if (offer.unitAmount === null || !offer.displayUnit) return 'Enquire';
  return `${formatMoney(offer.unitAmount)} / ${offer.displayUnit}`;
}
