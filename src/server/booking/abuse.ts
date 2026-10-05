import 'server-only';
import { headers } from 'next/headers';
import type { BookingConfig } from '@/commerce/booking-config.ts';
import { BookingGatewayError, type BookingOwner } from '@/commerce/booking-gateway.ts';
import { bookingAbuseBuckets, networkAddress } from './abuse-core.ts';

export async function abuseBuckets(owner: BookingOwner, config: BookingConfig): Promise<{ actorBucket: string; networkBucket: string }> {
  if (config.rateLimitProvider !== 'database' || !config.rateLimitHmacSecret || !config.trustedProxyHeader) {
    throw new BookingGatewayError('not_configured', 'Online booking is not configured yet.');
  }
  const network = networkAddress((await headers()).get(config.trustedProxyHeader));
  if (!network) throw new BookingGatewayError('service_unavailable', 'Booking is temporarily unavailable. Please try again.');
  return bookingAbuseBuckets({ ownerTokenHash: owner.ownerTokenHash, networkAddress: network, secret: config.rateLimitHmacSecret });
}
