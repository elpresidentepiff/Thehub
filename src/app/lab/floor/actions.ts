'use server';
/**
 * The floor lab's only way to the engine. The browser sends ids and London times; states,
 * prices and refusals are computed here. These are POST endpoints in any build, so each one
 * asserts development before doing anything.
 */
import { mockAvailability, type UnitState } from '@/commerce/availability.ts';
import { formatMoney, offersFor } from '@/commerce/catalogue.ts';
import { assertDevelopment } from '@/commerce/env.ts';
import { unitById } from '@/commerce/inventory.ts';
import { validatePeriod } from '@/commerce/period.ts';
import { quote, quoteProblemMessage } from '@/commerce/pricing.ts';
import { catalogue, LAB_YOURS, periodFrom, registry, type PeriodInput } from './lab-data.ts';

export interface FloorView {
  states: Record<string, UnitState>;
  /** Why the chosen time cannot be booked at all, in the visitor's words. */
  notice: string | null;
}

export async function floorStates(input: PeriodInput): Promise<FloorView> {
  assertDevelopment('The floor lab');
  const cat = catalogue();
  const period = periodFrom(input);
  if (!period) return { states: {}, notice: quoteProblemMessage('invalid_period', cat) };
  const checked = validatePeriod(period, { rules: cat.rules, now: new Date() });
  const states = await mockAvailability(registry, cat, { yours: LAB_YOURS }).unitStates(period);
  return { states: Object.fromEntries(states), notice: checked.ok ? null : quoteProblemMessage(checked.problem, cat) };
}

export type QuoteView =
  | { ok: true; lines: { label: string; detail: string; amount: string }[]; total: string }
  | { ok: false; message: string };

const duration = (mins: number) => (mins < 60 ? `${mins} min` : `${mins / 60} hour${mins === 60 ? '' : 's'}`);

export async function quoteUnit(input: PeriodInput & { unitId: string; addOns: string[] }): Promise<QuoteView> {
  assertDevelopment('The floor lab');
  const cat = catalogue();
  const period = periodFrom(input);
  const unit = typeof input?.unitId === 'string' ? unitById(registry, input.unitId) : undefined;
  if (!period) return { ok: false, message: quoteProblemMessage('invalid_period', cat) };
  if (!unit) return { ok: false, message: quoteProblemMessage('unknown_unit', cat) };

  // Quote the one-off booking where there is one; otherwise let the engine explain the offer.
  const offers = offersFor(unit, cat);
  const offer = offers.find((o) => o.billing === 'one_time') ?? offers[0];
  if (!offer) return { ok: false, message: quoteProblemMessage('unknown_offer', cat) };

  const addOns = (Array.isArray(input.addOns) ? input.addOns : []).slice(0, 5).map((id) => ({ id: String(id), quantity: 1 }));
  const result = quote({ unitId: unit.id, productId: offer.productId, period, addOns }, { registry, catalogue: cat, now: new Date() });
  if (!result.ok) return { ok: false, message: quoteProblemMessage(result.problem, cat, offer) };

  const q = result.quote;
  return {
    ok: true,
    lines: q.lines.map((l) => ({
      label: l.label,
      detail: l.kind === 'add_on' ? '' : q.offer.wholeDay ? 'Whole day' : duration(l.quantity * (q.offer.blockMinutes ?? 0)),
      amount: formatMoney(l.amount),
    })),
    total: formatMoney(q.total),
  };
}
