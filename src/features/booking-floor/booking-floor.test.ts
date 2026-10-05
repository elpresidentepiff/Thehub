import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import registryJson from '../../../data/inventory/unit4-l2.json' with { type: 'json' };
import { parseRegistry } from '../../commerce/inventory.ts';
import { publicUnitAccess, publicUnitProjection } from './public-unit.ts';

test('public floor preserves the approved nineteen-desk grouping', () => {
  const registry = parseRegistry(registryJson);
  const desks = registry.units.filter((unit) => unit.kind === 'desk' && !unit.retired);
  assert.equal(desks.length, 19);
  assert.deepEqual(desks.slice(0, 9).map((unit) => unit.id), [
    'L2-D001', 'L2-D002', 'L2-D003', 'L2-D004', 'L2-D005', 'L2-D006', 'L2-D007', 'L2-D008', 'L2-D009',
  ]);
  assert.deepEqual(desks.slice(9).map((unit) => unit.id), [
    'L2-D010', 'L2-D011', 'L2-D012', 'L2-D013', 'L2-D014', 'L2-D015', 'L2-D016', 'L2-D017', 'L2-D018', 'L2-D019',
  ]);
});

test('public booking entry point does not import development floor code or promise live commerce', () => {
  const page = readFileSync(new URL('../../app/book/page.tsx', import.meta.url), 'utf8');
  const picker = readFileSync(new URL('./FloorPicker.tsx', import.meta.url), 'utf8');
  const source = `${page}\n${picker}`;
  assert.doesNotMatch(source, /(?:@\/|\.\.\/).*lab\//);
  assert.doesNotMatch(source, /mock availability|development price|quoteUnit|floorStates/i);
  assert.match(source, /Online booking is being connected/);
  assert.doesNotMatch(source, /\.note\b|ROADMAP|Existing tenant/i);
});

test('non-bookable and unverified private offices never become actionable public inventory', () => {
  const registry = parseRegistry(registryJson);
  const offices = registry.units.filter((unit) => unit.kind === 'private_office');
  assert.ok(offices.length > 0);
  assert.ok(offices.every((unit) => publicUnitAccess(unit) === 'not_available'));
  assert.ok(registry.units.filter((unit) => unit.kind === 'desk').every((unit) => publicUnitAccess(unit) === 'selectable'));
});

test('public inventory projection strips every operator note before client serialization', () => {
  const registry = parseRegistry(registryJson);
  const output = JSON.stringify(registry.units.map(publicUnitProjection));
  assert.doesNotMatch(output, /ROADMAP|Existing tenant|Drawing labels|\"note\"/i);
});
