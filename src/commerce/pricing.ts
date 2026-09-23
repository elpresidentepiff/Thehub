/**
 * Quotes: the server's answer to "what would this cost?". The browser sends ids and times;
 * every amount comes from the catalogue, and the quote is recomputed at checkout rather than
 * trusted back from the client.
 *
 * Self-serve only: one-time offers. Recurring memberships and enquiry-only offers are refused
 * here with a reason the UI can explain (ROADMAP D10).
 */
import type { Catalogue, Offer } from './catalogue.ts';
import { offersFor } from './catalogue.ts';
import type { Registry, Unit } from './inventory.ts';
import { unitById } from './inventory.ts';
import type { Period, PeriodProblem } from './period.ts';
import { dayPeriod, durationMinutes, londonWallClock, validatePeriod } from './period.ts';

export interface QuoteRequest {
  unitId: string;
  productId: string;
  period: Period;
  addOns?: readonly { id: string; quantity: number }[];
}

export interface QuoteLine {
  kind: 'booking' | 'add_on';
  /** Offer productId or add-on id; the server maps it to a Stripe Price. */
  id: string;
  label: string;
  unitAmount: number; // pence per quantity
  quantity: number;
  amount: number;
}

export interface Quote {
  unit: Unit;
  offer: Offer;
  period: Period;
  currency: 'gbp';
  lines: readonly QuoteLine[];
  total: number;
}

export type QuoteProblem =
  | PeriodProblem
  | 'unknown_unit'
  | 'not_bookable'
  | 'unknown_offer'
  | 'enquiry_only'
  | 'membership_only'
  | 'not_whole_day'
  | 'not_whole_blocks'
  | 'unknown_add_on'
  | 'bad_add_on_quantity';

const MINUTES_PER: Record<string, number> = { hour: 60 };

/** Pence per Stripe line-item quantity. Throws on a catalogue that cannot be charged exactly. */
export function blockAmount(offer: Offer): number {
  if (offer.billing !== 'one_time' || offer.unitAmount === null) throw new Error(`${offer.productId} is not a one-time offer`);
  if (offer.wholeDay) return offer.unitAmount;
  const per = offer.displayUnit ? MINUTES_PER[offer.displayUnit] : undefined;
  if (!offer.blockMinutes || !per) {
    throw new Error(`${offer.productId}: one-time offers need wholeDay, or blockMinutes with an hourly price`);
  }
  const amount = (offer.unitAmount * offer.blockMinutes) / per;
  if (!Number.isInteger(amount)) throw new Error(`${offer.productId}: ${offer.blockMinutes} minutes is not a whole number of pence`);
  return amount;
}

export function quote(
  req: QuoteRequest,
  ctx: { registry: Registry; catalogue: Catalogue; now: Date },
): { ok: true; quote: Quote } | { ok: false; problem: QuoteProblem } {
  const bad = (problem: QuoteProblem) => ({ ok: false as const, problem });
  const { catalogue } = ctx;

  const unit = unitById(ctx.registry, req.unitId);
  if (!unit) return bad('unknown_unit');
  if (!unit.bookable || unit.retired) return bad('not_bookable');

  const offer = offersFor(unit, catalogue).find((o) => o.productId === req.productId);
  if (!offer) return bad('unknown_offer');
  if (offer.billing === 'enquiry') return bad('enquiry_only');
  if (offer.billing === 'recurring') return bad('membership_only');

  const checked = validatePeriod(req.period, {
    rules: catalogue.rules,
    now: ctx.now,
    ...(offer.minMinutes !== undefined ? { minMinutes: offer.minMinutes } : {}),
    ...(offer.maxMinutes !== undefined ? { maxMinutes: offer.maxMinutes } : {}),
  });
  if (!checked.ok) return bad(checked.problem);

  let quantity: number;
  if (offer.wholeDay) {
    const day = dayPeriod(londonWallClock(req.period.start).date, catalogue.rules);
    if (day.start.getTime() !== req.period.start.getTime() || day.end.getTime() !== req.period.end.getTime()) {
      return bad('not_whole_day');
    }
    quantity = 1;
  } else {
    const block = offer.blockMinutes ?? 0;
    const mins = durationMinutes(req.period);
    if (!block || mins % block) return bad('not_whole_blocks');
    quantity = mins / block;
  }

  const each = blockAmount(offer);
  const lines: QuoteLine[] = [
    { kind: 'booking', id: offer.productId, label: offer.label, unitAmount: each, quantity, amount: each * quantity },
  ];

  const seen = new Set<string>();
  for (const want of req.addOns ?? []) {
    const addOn = catalogue.addOns.find((a) => a.id === want.id);
    if (!addOn || !addOn.unitKinds.includes(unit.kind)) return bad('unknown_add_on');
    if (seen.has(addOn.id) || !Number.isInteger(want.quantity) || want.quantity < 1 || want.quantity > addOn.maxQuantity) {
      return bad('bad_add_on_quantity');
    }
    seen.add(addOn.id);
    lines.push({
      kind: 'add_on', id: addOn.id, label: addOn.label, unitAmount: addOn.unitAmount, quantity: want.quantity,
      amount: addOn.unitAmount * want.quantity,
    });
  }

  return {
    ok: true,
    quote: { unit, offer, period: req.period, currency: catalogue.currency, lines, total: lines.reduce((t, l) => t + l.amount, 0) },
  };
}
