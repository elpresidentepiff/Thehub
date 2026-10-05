import type { UnitState } from './availability.ts';
import type { Catalogue } from './catalogue.ts';
import { holdRefusal, type HoldRefusal } from './holds.ts';
import { unitById, type Registry } from './inventory.ts';
import type { Period } from './period.ts';
import { quote, quoteProblemMessage } from './pricing.ts';

export type BookingProblem = HoldRefusal | 'disabled' | 'not_configured' | 'service_unavailable';
export class BookingGatewayError extends Error {
  readonly problem: BookingProblem;
  constructor(problem: BookingProblem, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'BookingGatewayError';
    this.problem = problem;
  }
}
export interface BookingOwner { ownerTokenHash: string; customerId?: string | null; }
export interface AcquireHoldRequest extends BookingOwner {
  unitId: string; productId: string; environment: 'development' | 'preview' | 'production'; period: Period; holdMinutes: number;
}
export interface HoldRecord { reservationId: string; unitId: string; expiresAt: string; }
export interface BookingGateway {
  availability(floorId: string, period: Period, owner: BookingOwner): Promise<ReadonlyMap<string, UnitState>>;
  consumeBookingAttempt(actorBucket: string, networkBucket: string): Promise<void>;
  acquireHold(request: AcquireHoldRequest): Promise<HoldRecord>;
  releaseHold(reservationId: string, owner: BookingOwner): Promise<boolean>;
}

/**
 * Authoritative commercial gate used immediately before a hold RPC. It deliberately runs
 * the same quote rules as Checkout but returns no amount to the browser.
 */
export function validateHoldEligibility(
  request: { unitId: string; productId: string; period: Period },
  context: { registry: Registry; catalogue: Catalogue; now: Date },
): { ok: true; holdMinutes: number } | { ok: false; message: string } {
  const unit = unitById(context.registry, request.unitId);
  if (!unit || !unit.bookable || unit.retired || !unit.verified) {
    return { ok: false, message: quoteProblemMessage(unit ? 'not_bookable' : 'unknown_unit', context.catalogue) };
  }
  const result = quote(request, context);
  return result.ok
    ? { ok: true, holdMinutes: context.catalogue.holdMinutes }
    : { ok: false, message: quoteProblemMessage(result.problem, context.catalogue) };
}
export function gatewayError(error: unknown): BookingGatewayError {
  if (error instanceof BookingGatewayError) return error;
  const refusal = holdRefusal(error);
  if (refusal) return new BookingGatewayError(refusal.refusal, refusal.message, { cause: error });
  return new BookingGatewayError('service_unavailable', 'Booking is temporarily unavailable. Please try again.', { cause: error });
}
