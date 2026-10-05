import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogueFor, DEVELOPMENT_CATALOGUE } from './catalogue.ts';
import { BookingGatewayError, gatewayError, validateHoldEligibility } from './booking-gateway.ts';
import { dayPeriod, londonTime } from './period.ts';
import { NOW, registry } from './test-fixtures.ts';

test('gateway preserves known Hub refusals', () => {
  const error = gatewayError({ code: 'HB409' });
  assert.equal(error.problem, 'unavailable');
  assert.match(error.message, /Someone has just taken/);
});
test('gateway hides unknown infrastructure errors behind a stable vocabulary', () => {
  const cause = new Error('connection string and internal detail');
  const error = gatewayError(cause);
  assert.equal(error.problem, 'service_unavailable');
  assert.doesNotMatch(error.message, /connection string/);
  assert.equal(error.cause, cause);
});
test('gateway errors are idempotently normalized', () => {
  const original = new BookingGatewayError('disabled', 'Disabled');
  assert.equal(gatewayError(original), original);
});

test('commercial gate rejects the draft unverified floor before any database call', () => {
  const result = validateHoldEligibility(
    { unitId: 'L2-D001', productId: 'desk_day_pass', period: dayPeriod('2026-09-25', DEVELOPMENT_CATALOGUE.rules) },
    { registry, catalogue: DEVELOPMENT_CATALOGUE, now: NOW },
  );
  assert.deepEqual(result, { ok: false, message: 'This one cannot be booked.' });
});

test('no production hold can be authorized before the production catalogue is approved', () => {
  assert.throws(() => catalogueFor('production'), /No approved production catalogue/);
});

test('commercial gate applies the exact unit offer and whole-day rules', () => {
  const verified = {
    ...registry,
    units: registry.units.map((unit) => unit.id === 'L2-D001' ? { ...unit, verified: true } : unit),
  };
  const wholeDay = validateHoldEligibility(
    { unitId: 'L2-D001', productId: 'desk_day_pass', period: dayPeriod('2026-09-25', DEVELOPMENT_CATALOGUE.rules) },
    { registry: verified, catalogue: DEVELOPMENT_CATALOGUE, now: NOW },
  );
  assert.deepEqual(wholeDay, { ok: true, holdMinutes: DEVELOPMENT_CATALOGUE.holdMinutes });

  const partial = validateHoldEligibility(
    { unitId: 'L2-D001', productId: 'desk_day_pass', period: { start: londonTime('2026-09-25', '09:00'), end: londonTime('2026-09-25', '10:00') } },
    { registry: verified, catalogue: DEVELOPMENT_CATALOGUE, now: NOW },
  );
  assert.deepEqual(partial, { ok: false, message: 'Desks are booked for the whole day.' });
});

test('commercial gate rejects an offer that is not approved for the exact unit', () => {
  const verified = { ...registry, units: registry.units.map((unit) => ({ ...unit, verified: true })) };
  const result = validateHoldEligibility(
    { unitId: 'L2-MR01', productId: 'meeting_room_large_hire', period: { start: londonTime('2026-09-25', '09:00'), end: londonTime('2026-09-25', '10:00') } },
    { registry: verified, catalogue: DEVELOPMENT_CATALOGUE, now: NOW },
  );
  assert.deepEqual(result, { ok: false, message: 'That price does not apply to this place.' });
});
