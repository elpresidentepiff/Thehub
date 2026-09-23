import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEVELOPMENT_CATALOGUE } from './catalogue.ts';
import { dayPeriod, londonTime, londonWallClock, overlaps, validatePeriod, type Period } from './period.ts';
import { NOW } from './test-fixtures.ts';

const rules = DEVELOPMENT_CATALOGUE.rules;
const at = (iso: string) => new Date(iso);
const p = (start: string, end: string): Period => ({ start: at(start), end: at(end) });
const check = (period: Period, extra: { minMinutes?: number; maxMinutes?: number } = {}) =>
  validatePeriod(period, { rules, now: NOW, ...extra });

test('London wall-clock time follows BST and GMT, including the changeover days', () => {
  assert.equal(londonTime('2026-09-25', '09:00').toISOString(), '2026-09-25T08:00:00.000Z'); // BST
  assert.equal(londonTime('2026-11-03', '09:00').toISOString(), '2026-11-03T09:00:00.000Z'); // GMT
  assert.equal(londonTime('2026-10-25', '08:00').toISOString(), '2026-10-25T08:00:00.000Z'); // clocks went back at 02:00
  assert.equal(londonTime('2027-03-28', '08:00').toISOString(), '2027-03-28T07:00:00.000Z'); // clocks went forward at 01:00
  assert.deepEqual(londonWallClock(at('2026-09-25T08:00:00Z')), { date: '2026-09-25', minutes: 540, weekday: 5 });
  assert.throws(() => londonTime('25/09/2026', '09:00'), /YYYY-MM-DD/);
  assert.throws(() => londonTime('2026-09-25', '9am'), /HH:MM/);
});

test('periods are half-open: back-to-back bookings do not collide', () => {
  const morning = p('2026-09-25T08:00:00Z', '2026-09-25T11:00:00Z');
  assert.equal(overlaps(morning, p('2026-09-25T11:00:00Z', '2026-09-25T12:00:00Z')), false);
  assert.equal(overlaps(morning, p('2026-09-25T10:30:00Z', '2026-09-25T12:00:00Z')), true);
});

test('a whole opening day', () => {
  const day = dayPeriod('2026-09-25', rules);
  assert.equal(day.start.toISOString(), '2026-09-25T07:00:00.000Z');
  assert.equal(day.end.toISOString(), '2026-09-25T18:00:00.000Z');
  assert.deepEqual(check(day), { ok: true });
});

test('every refusal has a reason', () => {
  const cases: [Period, string, { minMinutes?: number; maxMinutes?: number }?][] = [
    [p('2026-09-25T10:00:00Z', '2026-09-25T09:00:00Z'), 'invalid_period'],
    [p('2026-09-24T07:30:00Z', '2026-09-24T09:30:00Z'), 'in_past'], // started 90 min ago
    [p('2027-01-04T09:00:00Z', '2027-01-04T10:00:00Z'), 'too_far_ahead'],
    [p('2026-09-25T09:15:00Z', '2026-09-25T10:00:00Z'), 'not_on_slot'],
    [p('2026-09-25T09:00:00.500Z', '2026-09-25T10:00:00Z'), 'not_on_slot'],
    [p('2026-09-25T16:00:00Z', '2026-09-26T09:00:00Z'), 'spans_days'],
    [p('2026-09-26T09:00:00Z', '2026-09-26T10:00:00Z'), 'closed_day'], // Saturday
    [p('2026-09-25T06:30:00Z', '2026-09-25T08:00:00Z'), 'outside_hours'], // 07:30 London
    [p('2026-09-25T17:00:00Z', '2026-09-25T18:30:00Z'), 'outside_hours'], // until 19:30 London
    [p('2026-09-25T09:00:00Z', '2026-09-25T09:30:00Z'), 'too_short', { minMinutes: 60 }],
    [p('2026-09-25T07:00:00Z', '2026-09-25T16:00:00Z'), 'too_long', { maxMinutes: 480 }],
  ];
  for (const [period, problem, extra] of cases) {
    assert.deepEqual(check(period, extra), { ok: false, problem }, `${period.start.toISOString()} → ${problem}`);
  }
});

test('the slot in progress can still be booked', () => {
  // NOW is 10:00 London; 09:30–11:00 started half an hour ago.
  assert.deepEqual(check(p('2026-09-24T08:30:00Z', '2026-09-24T10:00:00Z')), { ok: true });
});
