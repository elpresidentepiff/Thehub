import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { UnitState } from './availability.ts';
import { bookingAction, createLatestRequestCoordinator, resolveBookingRefresh } from './booking-action.ts';

test('only an available unit may expose commercial choices', () => {
  const blocked: UnitState[] = ['held', 'unavailable', 'closed', 'not_bookable', 'yours'];
  for (const state of blocked) {
    const action = bookingAction(state, true);
    assert.equal(action.showCommerce, false, state);
    assert.equal(action.canHold, false, state);
  }

  assert.equal(bookingAction('available').showCommerce, true);
});

test('the development floor stays fail-closed even when a place is available', () => {
  assert.deepEqual(bookingAction('available'), {
    showCommerce: true,
    canHold: false,
    buttonLabel: 'Booking not connected yet',
    explanation: 'This place is free, but live holds stay off until the secure booking backend is connected.',
  });
  assert.equal(bookingAction('available', true).canHold, true);
});

test('every unavailable state has a specific non-actionable label and explanation', () => {
  const actions = (['held', 'unavailable', 'closed', 'not_bookable', 'yours'] as const).map((state) => bookingAction(state));
  assert.deepEqual(
    actions.map((action) => action.buttonLabel),
    ['Being booked by someone else', 'Already booked', 'Closed for this time', 'Not available to book', 'Already yours'],
  );
  assert.equal(new Set(actions.map((action) => action.explanation)).size, actions.length);
  assert.match(bookingAction('yours').explanation, /already held or booked for you/i);
});

test('a selection immediately after a period change fetches fresh states before quoting', async () => {
  let releaseOld!: () => void;
  const oldStates = new Promise<{ states: Record<string, UnitState> }>((resolve) => {
    releaseOld = () => resolve({ states: { desk: 'unavailable' } });
  });
  const stateCalls: string[] = [];
  const quoteCalls: { period: string; unitId: string; addOns: string[] }[] = [];
  const loaders = {
    states: async (period: string) => {
      stateCalls.push(period);
      return period === 'old' ? oldStates : { states: { desk: 'available' as UnitState } };
    },
    quote: async (request: { period: string; unitId: string; addOns: string[] }) => {
      quoteCalls.push(request);
      return { total: 'current-period quote' };
    },
  };

  const superseded = resolveBookingRefresh({ period: 'old', unitId: null, addOns: [] }, loaders);
  const latest = await resolveBookingRefresh({ period: 'new', unitId: 'desk', addOns: ['tea'] }, loaders);

  assert.deepEqual(stateCalls, ['old', 'new']);
  assert.deepEqual(quoteCalls, [{ period: 'new', unitId: 'desk', addOns: ['tea'] }]);
  assert.deepEqual(latest.quote, { total: 'current-period quote' });
  releaseOld();
  await superseded;
});

test('a fresh availability response which omits the selected unit fails closed', async () => {
  let quoted = false;
  const result = await resolveBookingRefresh(
    { period: 'new', unitId: 'missing', addOns: [] },
    {
      states: async () => ({ states: {} }),
      quote: async () => {
        quoted = true;
        return { total: 'must not happen' };
      },
    },
  );

  assert.equal(result.quote, null);
  assert.equal(quoted, false);
});

test('a late superseded refresh cannot overwrite the latest applied view and quote', async () => {
  const coordinator = createLatestRequestCoordinator();
  let releaseA!: (result: { view: string; quote: string }) => void;
  const resultA = new Promise<{ view: string; quote: string }>((resolve) => {
    releaseA = resolve;
  });
  let applied: { view: string; quote: string } | undefined;

  async function applyWhenLatest(result: Promise<{ view: string; quote: string }>) {
    const isLatest = coordinator.begin();
    const resolved = await result;
    if (isLatest()) applied = resolved;
  }

  const pendingA = applyWhenLatest(resultA);
  await applyWhenLatest(Promise.resolve({ view: 'period B', quote: 'quote B' }));
  assert.deepEqual(applied, { view: 'period B', quote: 'quote B' });

  releaseA({ view: 'period A', quote: 'quote A' });
  await pendingA;
  assert.deepEqual(applied, { view: 'period B', quote: 'quote B' });
});
