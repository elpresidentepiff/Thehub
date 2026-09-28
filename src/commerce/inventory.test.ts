import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isUnitId, parseRegistry, unitById } from './inventory.ts';
import { registry, registryJson } from './test-fixtures.ts';

test('the Unit 4 L2 registry parses', () => {
  assert.equal(registry.floor.id, 'unit4-l2');
  const count = (kind: string) => registry.units.filter((u) => u.kind === kind).length;
  assert.deepEqual([count('desk'), count('meeting_room'), count('private_office')], [19, 2, 2]);
  assert.equal(unitById(registry, 'L2-MR02')?.capacity, 8);
  assert.equal(unitById(registry, 'L2-OFFICE01')?.bookable, false); // ACG/Iffy's pending (D6)
  assert.ok(registry.units.every((u) => !u.verified), 'nothing is verified until the floor walk');

  const desks = registry.units.filter((u) => u.kind === 'desk');
  assert.deepEqual(desks.slice(0, 9).map((u) => u.rotDeg), [81, 81, -9, 81, 81, -9, 81, 81, -9]);
  for (let start = 0; start < 9; start += 3) {
    const [left, right, horizontal] = desks.slice(start, start + 3);
    assert.ok(left && right && horizontal);
    assert.ok(horizontal.y > Math.max(left.y, right.y), 'each horizontal wall desk faces into the room');
  }
  assert.ok(desks.slice(9).every((u) => u.rotDeg === -9), 'the ten centre desks follow the drawing grid');
});

test('unit ids follow the database constraint', () => {
  for (const id of ['L2-D001', 'L2-MR01', 'L2-OFFICE03', 'L12-EVENT01']) assert.ok(isUnitId(id), id);
  for (const id of ['L2-D1', 'l2-D001', 'L2-MR001', 'L2-DESK01', 'L2-D001 ']) assert.ok(!isUnitId(id), id);
});

test('malformed registries fail with the path to the problem', () => {
  const broken = (edit: (units: Record<string, unknown>[]) => void) => {
    const json = registryJson();
    edit(json.units as Record<string, unknown>[]);
    return () => parseRegistry(json);
  };
  assert.throws(broken((u) => (u[0]!.id = 'D001')), /units\[0\]\.id: "D001" is not a unit id/);
  assert.throws(broken((u) => (u[0]!.kind = 'meeting_room')), /id L2-D001 does not match kind meeting_room/);
  assert.throws(broken((u) => (u[1]!.id = 'L2-D001')), /units\[1\]\.id: duplicate id L2-D001/);
  assert.throws(broken((u) => (u[0]!.space_id = 'L2-ROOF')), /unknown space L2-ROOF/);
  assert.throws(broken((u) => (u[0]!.capacity = 0)), /capacity: must be a positive integer/);
  assert.throws(broken((u) => (u[0]!.footprint = [[0, 0], [40, 0], [0, 1]])), /outside the 31\.707 x 18\.442 m floor/);
  assert.throws(broken((u) => (u[0]!.footprint = [[0, 0], [1, 1]])), /polygon of 3\+ points/);
});
