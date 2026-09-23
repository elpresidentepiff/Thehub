/**
 * The bookable-unit registry: identity and geometry only (data/inventory/*.json).
 * Prices, availability and bookings are joined to it by id; none of them live here.
 * The same ids are enforced by check constraints in hub.bookable_units.
 */
export type UnitKind = 'desk' | 'meeting_room' | 'private_office' | 'event_space';
export type Point = readonly [number, number];

export interface Unit {
  id: string;
  spaceId: string;
  kind: UnitKind;
  label: string;
  capacity: number;
  x: number;
  y: number;
  rotDeg: number;
  footprint: readonly Point[];
  bookable: boolean;
  verified: boolean;
  retired: boolean;
  note?: string;
}

export interface Space {
  id: string;
  kind: string;
  name: string;
  footprint?: readonly Point[];
}

export interface Floor {
  id: string;
  name: string;
  planRevision: string;
  planAsset: string;
  width: number;
  height: number;
}

export interface Registry {
  floor: Floor;
  status: string;
  spaces: readonly Space[];
  units: readonly Unit[];
}

const UNIT_ID = /^L[0-9]+-(D[0-9]{3}|MR[0-9]{2}|OFFICE[0-9]{2}|EVENT[0-9]{2})$/;
const ID_KIND: Record<UnitKind, RegExp> = {
  desk: /-D[0-9]{3}$/,
  meeting_room: /-MR[0-9]{2}$/,
  private_office: /-OFFICE[0-9]{2}$/,
  event_space: /-EVENT[0-9]{2}$/,
};

export function isUnitId(id: string): boolean {
  return UNIT_ID.test(id);
}

type Json = Record<string, unknown>;
const obj = (v: unknown, where: string): Json => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${where}: expected an object`);
  return v as Json;
};
const str = (v: unknown, where: string): string => {
  if (typeof v !== 'string' || !v) throw new Error(`${where}: expected a non-empty string`);
  return v;
};
const num = (v: unknown, where: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${where}: expected a number`);
  return v;
};
const points = (v: unknown, where: string): Point[] => {
  if (!Array.isArray(v) || v.length < 3) throw new Error(`${where}: expected a polygon of 3+ points`);
  return v.map((p, i) => {
    if (!Array.isArray(p) || p.length !== 2) throw new Error(`${where}[${i}]: expected [x, y]`);
    return [num(p[0], `${where}[${i}][0]`), num(p[1], `${where}[${i}][1]`)] as const;
  });
};

/** Validate registry JSON and return it typed. Throws with a path on the first problem. */
export function parseRegistry(input: unknown): Registry {
  const root = obj(input, 'registry');
  const f = obj(root.floor, 'floor');
  const floor: Floor = {
    id: str(f.id, 'floor.id'),
    name: str(f.name, 'floor.name'),
    planRevision: str(f.plan_revision, 'floor.plan_revision'),
    planAsset: str(f.plan_asset, 'floor.plan_asset'),
    width: num(f.width_m, 'floor.width_m'),
    height: num(f.height_m, 'floor.height_m'),
  };

  const spaces: Space[] = (Array.isArray(root.spaces) ? root.spaces : []).map((s, i) => {
    const o = obj(s, `spaces[${i}]`);
    return {
      id: str(o.id, `spaces[${i}].id`),
      kind: str(o.kind, `spaces[${i}].kind`),
      name: str(o.name, `spaces[${i}].name`),
      ...(o.footprint ? { footprint: points(o.footprint, `spaces[${i}].footprint`) } : {}),
    };
  });
  const spaceIds = new Set(spaces.map((s) => s.id));

  if (!Array.isArray(root.units)) throw new Error('units: expected an array');
  const seen = new Set<string>();
  const units: Unit[] = root.units.map((u, i) => {
    const o = obj(u, `units[${i}]`);
    const where = `units[${i}]`;
    const id = str(o.id, `${where}.id`);
    if (!isUnitId(id)) throw new Error(`${where}.id: "${id}" is not a unit id (L<floor>-D001 / MR01 / OFFICE01 / EVENT01)`);
    if (seen.has(id)) throw new Error(`${where}.id: duplicate id ${id}`);
    seen.add(id);
    const kind = str(o.kind, `${where}.kind`) as UnitKind;
    if (!(kind in ID_KIND)) throw new Error(`${where}.kind: unknown kind ${kind}`);
    if (!ID_KIND[kind].test(id)) throw new Error(`${where}: id ${id} does not match kind ${kind}`);
    const spaceId = str(o.space_id, `${where}.space_id`);
    if (!spaceIds.has(spaceId)) throw new Error(`${where}.space_id: unknown space ${spaceId}`);
    const capacity = num(o.capacity, `${where}.capacity`);
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error(`${where}.capacity: must be a positive integer`);
    const footprint = points(o.footprint, `${where}.footprint`);
    for (const [x, y] of footprint) {
      if (x < 0 || y < 0 || x > floor.width || y > floor.height) {
        throw new Error(`${where}.footprint: point (${x}, ${y}) is outside the ${floor.width} x ${floor.height} m floor`);
      }
    }
    return {
      id,
      spaceId,
      kind,
      label: str(o.label, `${where}.label`),
      capacity,
      x: num(o.x_m, `${where}.x_m`),
      y: num(o.y_m, `${where}.y_m`),
      rotDeg: typeof o.rot_deg === 'number' ? o.rot_deg : 0,
      footprint,
      bookable: o.bookable !== false,
      verified: o.verified === true,
      retired: o.retired === true,
      ...(typeof o.note === 'string' ? { note: o.note } : {}),
    };
  });

  return { floor, status: typeof root.status === 'string' ? root.status : '', spaces, units };
}

export function unitById(registry: Registry, id: string): Unit | undefined {
  return registry.units.find((u) => u.id === id);
}
