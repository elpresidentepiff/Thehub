'use server';

import registryJson from '../../../data/inventory/unit4-l2.json';
import type { UnitState } from '@/commerce/availability.ts';
import { bookingConfig } from '@/commerce/booking-config.ts';
import { periodFrom, parseAvailabilityInput, parseHoldInput, parseReleaseInput } from '@/commerce/booking-input.ts';
import { BookingGatewayError, gatewayError, validateHoldEligibility, type BookingProblem, type HoldRecord } from '@/commerce/booking-gateway.ts';
import { catalogueFor } from '@/commerce/catalogue.ts';
import { hubEnvironment } from '@/commerce/env.ts';
import { parseRegistry } from '@/commerce/inventory.ts';
import { abuseBuckets } from '@/server/booking/abuse.ts';
import { anonymousBookingOwner } from '@/server/booking/owner.ts';
import { availabilityGateway, writableBookingGateway } from '@/server/booking/gateway.ts';

export type BookingActionFailure = { ok: false; problem: BookingProblem; message: string };
export type AvailabilityActionResult = { ok: true; states: Record<string, UnitState> } | BookingActionFailure;
export type HoldActionResult = { ok: true; hold: HoldRecord } | BookingActionFailure;
export type ReleaseActionResult = { ok: true; released: boolean } | BookingActionFailure;

const fail = (error: unknown): BookingActionFailure => {
  const safe = gatewayError(error);
  return { ok: false, problem: safe.problem, message: safe.message };
};
const invalid = (): BookingActionFailure => ({ ok: false, problem: 'invalid', message: 'That booking request is not valid.' });
const registry = parseRegistry(registryJson);

/** Real availability only: never falls back to the floor lab's mock provider. */
export async function bookingAvailability(input: unknown): Promise<AvailabilityActionResult> {
  const parsed = parseAvailabilityInput(input);
  const period = parsed && periodFrom(parsed);
  if (!parsed || !period) return invalid();
  try {
    const gateway = availabilityGateway();
    const owner = await anonymousBookingOwner();
    const states = await gateway.availability(parsed.floorId, period, owner);
    return { ok: true, states: Object.fromEntries(states) };
  } catch (error) { return fail(error); }
}

/** Creates a short database hold. Price selection is server/database controlled by product id. */
export async function acquireBookingHold(input: unknown): Promise<HoldActionResult> {
  const parsed = parseHoldInput(input);
  const period = parsed && periodFrom(parsed);
  if (!parsed || !period) return invalid();
  try {
    const environment = hubEnvironment();
    let catalogue;
    try { catalogue = catalogueFor(environment); }
    catch { throw new BookingGatewayError('not_configured', 'Online booking is not configured yet.'); }
    const eligible = validateHoldEligibility(
      { unitId: parsed.unitId, productId: parsed.productId, period },
      { registry, catalogue, now: new Date() },
    );
    if (!eligible.ok) return { ok: false, problem: 'invalid', message: eligible.message };

    const config = bookingConfig();
    const gateway = writableBookingGateway(config);
    const owner = await anonymousBookingOwner();
    const buckets = await abuseBuckets(owner, config);
    await gateway.consumeBookingAttempt(buckets.actorBucket, buckets.networkBucket);
    const hold = await gateway.acquireHold({
      unitId: parsed.unitId,
      productId: parsed.productId,
      environment,
      period,
      holdMinutes: eligible.holdMinutes,
      ...owner,
    });
    return { ok: true, hold };
  } catch (error) { return fail(error); }
}

export async function releaseBookingHold(input: unknown): Promise<ReleaseActionResult> {
  const parsed = parseReleaseInput(input);
  if (!parsed) return invalid();
  try {
    const gateway = writableBookingGateway();
    const owner = await anonymousBookingOwner();
    return { ok: true, released: await gateway.releaseHold(parsed.reservationId, owner) };
  } catch (error) { return fail(error); }
}
