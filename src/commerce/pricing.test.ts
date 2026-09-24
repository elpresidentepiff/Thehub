import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogueFor, DEVELOPMENT_CATALOGUE, formatMoney, formatPrice } from './catalogue.ts';
import { parseRegistry } from './inventory.ts';
import { blockAmount, quote, quoteProblemMessage, type QuoteRequest } from './pricing.ts';
import { NOW, registry, registryJson } from './test-fixtures.ts';

const catalogue = DEVELOPMENT_CATALOGUE;
const at = (iso: string) => new Date(iso);
const ask = (req: Partial<QuoteRequest> & Pick<QuoteRequest, 'unitId' | 'productId'>, reg = registry) =>
  quote({ period: { start: at('2026-09-25T09:00:00Z'), end: at('2026-09-25T11:00:00Z') }, ...req }, { registry: reg, catalogue, now: NOW });

test('a day pass is the whole opening day, one line', () => {
  const r = ask({ unitId: 'L2-D004', productId: 'desk_day_pass', period: { start: at('2026-09-25T07:00:00Z'), end: at('2026-09-25T18:00:00Z') } });
  assert.ok(r.ok);
  assert.deepEqual(r.quote.lines, [{ kind: 'booking', id: 'desk_day_pass', label: 'Day pass', unitAmount: 3500, quantity: 1, amount: 3500 }]);
  assert.equal(r.quote.total, 3500);
  assert.deepEqual(ask({ unitId: 'L2-D004', productId: 'desk_day_pass' }), { ok: false, problem: 'not_whole_day' });
});

test('rooms are charged per 30-minute block at the room rate, plus add-ons', () => {
  const r = ask({ unitId: 'L2-MR01', productId: 'meeting_room_small_hire', addOns: [{ id: 'room_refreshments', quantity: 1 }] });
  assert.ok(r.ok);
  assert.deepEqual(r.quote.lines.map((l) => [l.id, l.unitAmount, l.quantity, l.amount]), [
    ['meeting_room_small_hire', 1900, 4, 7600],
    ['room_refreshments', 1500, 1, 1500],
  ]);
  assert.equal(r.quote.total, 9100);
  const large = ask({ unitId: 'L2-MR02', productId: 'meeting_room_large_hire' });
  assert.ok(large.ok && large.quote.total === 11000);
});

test('refusals the visitor can act on', () => {
  const cases: [Parameters<typeof ask>[0], string][] = [
    [{ unitId: 'L2-D999', productId: 'desk_day_pass' }, 'unknown_unit'],
    [{ unitId: 'L2-OFFICE01', productId: 'private_office_enquiry' }, 'not_bookable'],
    [{ unitId: 'L2-MR02', productId: 'meeting_room_small_hire' }, 'unknown_offer'], // another room's rate
    [{ unitId: 'L2-D001', productId: 'meeting_room_small_hire' }, 'unknown_offer'],
    [{ unitId: 'L2-D001', productId: 'dedicated_desk_monthly' }, 'membership_only'],
    [{ unitId: 'L2-MR01', productId: 'meeting_room_small_hire', period: { start: at('2026-09-25T09:00:00Z'), end: at('2026-09-25T09:30:00Z') } }, 'too_short'],
    [{ unitId: 'L2-MR01', productId: 'meeting_room_small_hire', period: { start: at('2026-09-25T07:00:00Z'), end: at('2026-09-25T16:00:00Z') } }, 'too_long'],
    [{ unitId: 'L2-MR01', productId: 'meeting_room_small_hire', period: { start: at('2026-09-26T09:00:00Z'), end: at('2026-09-26T11:00:00Z') } }, 'closed_day'],
    [{ unitId: 'L2-MR01', productId: 'meeting_room_small_hire', addOns: [{ id: 'monitor', quantity: 1 }] }, 'unknown_add_on'],
    [{ unitId: 'L2-MR01', productId: 'meeting_room_small_hire', addOns: [{ id: 'room_refreshments', quantity: 2 }] }, 'bad_add_on_quantity'],
    [{ unitId: 'L2-MR01', productId: 'meeting_room_small_hire', addOns: [{ id: 'room_refreshments', quantity: 1 }, { id: 'room_refreshments', quantity: 1 }] }, 'bad_add_on_quantity'],
  ];
  for (const [req, problem] of cases) assert.deepEqual(ask(req), { ok: false, problem }, `${req.unitId} ${req.productId} → ${problem}`);
});

test('enquiry-only offers are never quoted', () => {
  const json = registryJson();
  (json.units as Record<string, unknown>[]).find((u) => u.id === 'L2-OFFICE01')!.bookable = true;
  assert.deepEqual(ask({ unitId: 'L2-OFFICE01', productId: 'private_office_enquiry' }, parseRegistry(json)), { ok: false, problem: 'enquiry_only' });
});

test('every one-time development offer charges a whole number of pence', () => {
  for (const offer of catalogue.offers.filter((o) => o.billing === 'one_time')) {
    assert.ok(Number.isInteger(blockAmount(offer)), offer.productId);
  }
  assert.throws(() => blockAmount({ ...catalogue.offers[2]!, unitAmount: 3801 }), /not a whole number of pence/);
});

test('production refuses to sell at development prices', () => {
  assert.throws(() => catalogueFor('production'), /No approved production catalogue/);
  assert.equal(catalogueFor('preview').environment, 'preview');
  assert.deepEqual(catalogue.offers.map(formatPrice), ['£35 / day', '£395 / month', '£38 / hour', '£55 / hour', 'Enquire', 'Enquire']);
});

test('money and refusals read the way a visitor would say them', () => {
  assert.deepEqual([3500, 1950, 125000].map(formatMoney), ['£35', '£19.50', '£1,250']);
  const room = catalogue.offers[2]!;
  assert.equal(quoteProblemMessage('too_short', catalogue, room), 'Book this for at least an hour.');
  assert.equal(quoteProblemMessage('too_long', catalogue, room), 'Book this for 8 hours at most.');
  assert.equal(quoteProblemMessage('outside_hours', catalogue), 'The floor is open 08:00–19:00.');
  assert.equal(quoteProblemMessage('not_whole_blocks', catalogue, room), 'Times go in 30-minute steps.');
});
