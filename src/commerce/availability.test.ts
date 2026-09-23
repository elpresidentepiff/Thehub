import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mockAvailability } from './availability.ts';
import { DEVELOPMENT_CATALOGUE } from './catalogue.ts';
import { registry } from './test-fixtures.ts';

const dev = { HUB_ENV: 'development' };
const period = (start: string, end: string) => ({ start: new Date(start), end: new Date(end) });
const friday = period('2026-09-25T09:00:00Z', '2026-09-25T11:00:00Z');

test('mock availability cannot exist outside development', () => {
  assert.throws(() => mockAvailability(registry, DEVELOPMENT_CATALOGUE, { env: { NODE_ENV: 'production' } }), /only in development/);
  assert.throws(() => mockAvailability(registry, DEVELOPMENT_CATALOGUE, { env: { HUB_ENV: 'preview' } }), /only in development/);
});

test('mock availability is repeatable and uses the database vocabulary', async () => {
  const mock = mockAvailability(registry, DEVELOPMENT_CATALOGUE, { env: dev, yours: ['L2-D003'] });
  assert.equal(mock.source, 'mock');
  const first = await mock.unitStates(friday);
  assert.deepEqual([...(await mock.unitStates(friday))], [...first]);
  assert.equal(first.size, registry.units.length);
  assert.equal(first.get('L2-OFFICE01'), 'not_bookable');
  assert.equal(first.get('L2-D003'), 'yours');
  const states = new Set(first.values());
  for (const s of states) assert.ok(['available', 'held', 'unavailable', 'not_bookable', 'yours'].includes(s), s);
  assert.ok(states.has('available'));
});

test('closed days and hours close every bookable unit', async () => {
  const mock = mockAvailability(registry, DEVELOPMENT_CATALOGUE, { env: dev });
  for (const p of [period('2026-09-26T09:00:00Z', '2026-09-26T11:00:00Z'), period('2026-09-25T17:30:00Z', '2026-09-25T18:30:00Z')]) {
    const states = await mock.unitStates(p);
    assert.equal(states.get('L2-MR01'), 'closed');
    assert.equal(states.get('L2-OFFICE02'), 'not_bookable'); // not_bookable outranks closed
  }
});
