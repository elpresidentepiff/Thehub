import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAvailabilityInput, parseHoldInput, parseReleaseInput, periodFrom } from './booking-input.ts';

test('period input is interpreted as a London wall-clock period', () => {
  assert.equal(periodFrom({ date: '2027-01-12', from: '09:00', until: '10:30' })?.start.toISOString(), '2027-01-12T09:00:00.000Z');
  assert.equal(periodFrom({ date: '2027-07-12', from: '09:00', until: '10:30' })?.start.toISOString(), '2027-07-12T08:00:00.000Z');
});

test('invalid and backwards periods are rejected', () => {
  assert.equal(periodFrom({ date: 'bad', from: '09:00', until: '10:00' }), null);
  assert.equal(periodFrom({ date: '2027-01-12', from: '10:00', until: '09:00' }), null);
});

test('availability accepts only a bounded floor id and valid period', () => {
  assert.deepEqual(parseAvailabilityInput({ floorId: 'unit4-l2', date: '2027-01-12', from: '09:00', until: '10:00' }), { floorId: 'unit4-l2', date: '2027-01-12', from: '09:00', until: '10:00' });
  assert.equal(parseAvailabilityInput({ floorId: '../private', date: '2027-01-12', from: '09:00', until: '10:00' }), null);
});

test('hold input contains ids, never an amount or Stripe price', () => {
  const parsed = parseHoldInput({ unitId: 'L2-D001', productId: 'hot_desk_hour', amount: 1, stripePriceId: 'price_attacker', date: '2027-01-12', from: '09:00', until: '10:00' });
  assert.deepEqual(parsed, { unitId: 'L2-D001', productId: 'hot_desk_hour', date: '2027-01-12', from: '09:00', until: '10:00' });
  assert.equal(parseHoldInput({ unitId: 'bad', productId: 'hot_desk_hour', date: '2027-01-12', from: '09:00', until: '10:00' }), null);
});

test('release input requires a UUID', () => {
  assert.deepEqual(parseReleaseInput({ reservationId: '00000000-0000-4000-8000-000000000001' }), { reservationId: '00000000-0000-4000-8000-000000000001' });
  assert.equal(parseReleaseInput({ reservationId: '1' }), null);
});
