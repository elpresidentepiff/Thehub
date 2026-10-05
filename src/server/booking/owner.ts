import 'server-only';
import { cookies } from 'next/headers';
import { hashOwnerToken, newOwnerToken } from '@/commerce/holds.ts';
import type { BookingOwner } from '@/commerce/booking-gateway.ts';

const COOKIE = 'hub_booking_owner';
const THIRTY_DAYS = 30 * 24 * 60 * 60;

/** Returns an opaque anonymous owner and stores only the raw token in an HttpOnly cookie. */
export async function anonymousBookingOwner(): Promise<BookingOwner> {
  const jar = await cookies();
  let token = jar.get(COOKIE)?.value;
  if (token) {
    try { return { ownerTokenHash: hashOwnerToken(token), customerId: null }; } catch { token = undefined; }
  }

  token = newOwnerToken();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: THIRTY_DAYS,
  });
  return { ownerTokenHash: hashOwnerToken(token), customerId: null };
}
