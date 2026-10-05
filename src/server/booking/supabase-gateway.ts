import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UnitState } from '@/commerce/availability.ts';
import {
  gatewayError,
  type AcquireHoldRequest,
  type BookingGateway,
  type BookingOwner,
  type HoldRecord,
} from '@/commerce/booking-gateway.ts';
import type { Period } from '@/commerce/period.ts';
import { supabaseAdmin } from '@/server/supabase/admin.ts';

const STATES = new Set<UnitState>(['available', 'held', 'unavailable', 'closed', 'not_bookable', 'yours']);

type RpcResult = { data: unknown; error: unknown };
type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult> };
const api = (client: SupabaseClient): RpcClient => client.schema('api') as unknown as RpcClient;

function rows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) throw new Error('Booking database returned an invalid response');
  return data.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null && !Array.isArray(row));
}

export class SupabaseBookingGateway implements BookingGateway {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient = supabaseAdmin()) { this.client = client; }

  async consumeBookingAttempt(actorBucket: string, networkBucket: string): Promise<void> {
    try {
      const { data, error } = await api(this.client).rpc('server_consume_booking_attempt', {
        p_actor_bucket: actorBucket,
        p_network_bucket: networkBucket,
      });
      if (error) throw error;
      if (data !== true) throw new Error('Booking database returned an invalid rate-limit result');
    } catch (error) { throw gatewayError(error); }
  }

  async availability(floorId: string, period: Period, owner: BookingOwner): Promise<ReadonlyMap<string, UnitState>> {
    try {
      const { data, error } = await api(this.client).rpc('server_unit_availability', {
        p_floor_id: floorId,
        p_starts_at: period.start.toISOString(),
        p_ends_at: period.end.toISOString(),
        p_customer_id: owner.customerId ?? null,
        p_owner_token_hash: owner.ownerTokenHash,
      });
      if (error) throw error;
      const states = new Map<string, UnitState>();
      for (const row of rows(data)) {
        if (typeof row.unit_id !== 'string' || typeof row.state !== 'string' || !STATES.has(row.state as UnitState)) {
          throw new Error('Booking database returned an invalid availability row');
        }
        states.set(row.unit_id, row.state as UnitState);
      }
      return states;
    } catch (error) { throw gatewayError(error); }
  }

  async acquireHold(request: AcquireHoldRequest): Promise<HoldRecord> {
    try {
      const { data, error } = await api(this.client).rpc('server_acquire_hold', {
        p_unit_id: request.unitId,
        p_product_id: request.productId,
        p_environment: request.environment,
        p_starts_at: request.period.start.toISOString(),
        p_ends_at: request.period.end.toISOString(),
        p_hold_minutes: request.holdMinutes,
        p_customer_id: request.customerId ?? null,
        p_owner_token_hash: request.ownerTokenHash,
      });
      if (error) throw error;
      const row = rows(data)[0];
      if (!row || typeof row.reservation_id !== 'string' || typeof row.unit_id !== 'string' || typeof row.hold_expires_at !== 'string') {
        throw new Error('Booking database returned an invalid hold');
      }
      return { reservationId: row.reservation_id, unitId: row.unit_id, expiresAt: row.hold_expires_at };
    } catch (error) { throw gatewayError(error); }
  }

  async releaseHold(reservationId: string, owner: BookingOwner): Promise<boolean> {
    try {
      const { data, error } = await api(this.client).rpc('server_release_hold', {
        p_reservation_id: reservationId,
        p_customer_id: owner.customerId ?? null,
        p_owner_token_hash: owner.ownerTokenHash,
      });
      if (error) throw error;
      if (typeof data !== 'boolean') throw new Error('Booking database returned an invalid release result');
      return data;
    } catch (error) { throw gatewayError(error); }
  }
}
