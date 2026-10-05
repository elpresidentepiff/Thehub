import type { Unit } from '@/commerce/inventory.ts';

export type PublicUnitAccess = 'selectable' | 'not_available';

/**
 * Only inventory explicitly permitted for online use may become interactive. Private offices
 * also require physical verification: until then they remain visible as floor-plan scenery and
 * are described publicly with generic, non-operational wording.
 */
export function publicUnitAccess(unit: Unit): PublicUnitAccess {
  if (!unit.bookable) return 'not_available';
  if (unit.kind === 'private_office' && !unit.verified) return 'not_available';
  return 'selectable';
}

/** Remove operator-only annotations before inventory crosses the Server Component boundary. */
export function publicUnitProjection(unit: Unit): Omit<Unit, 'note'> {
  const { note: _operatorOnly, ...publicUnit } = unit;
  return publicUnit;
}
