import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export function networkAddress(value: string | null): string | null {
  const first = value?.split(',', 1)[0]?.trim();
  return first && first.length <= 64 && isIP(first) ? first : null;
}

/** Domain-separated, privacy-preserving buckets. Raw network addresses never reach storage. */
export function bookingAbuseBuckets(input: { ownerTokenHash: string; networkAddress: string; secret: string }): {
  actorBucket: string;
  networkBucket: string;
} {
  const digest = (domain: string, value: string) => createHmac('sha256', input.secret).update(`${domain}\0${value}`).digest('hex');
  return {
    actorBucket: digest('booking-owner-v1', input.ownerTokenHash),
    networkBucket: digest('booking-network-v1', input.networkAddress),
  };
}
