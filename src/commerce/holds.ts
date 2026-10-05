/**
 * Holds: who owns one, and what the database means when it refuses one.
 *
 * An anonymous visitor owns a hold through an opaque token kept in an httpOnly cookie. Only
 * its SHA-256 reaches the database (hub.reservations.owner_token_hash), so a leaked table
 * cannot be replayed as a cookie. Whether visitors may book without signing in is still
 * open (ROADMAP D5); the database accepts either owner.
 */
import { createHash, randomBytes } from 'node:crypto';

const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url, unpadded

export function newOwnerToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOwnerToken(token: string): string {
  if (!TOKEN.test(token)) throw new Error('not a hold owner token');
  return createHash('sha256').update(token).digest('hex');
}

export type HoldRefusal = 'invalid' | 'not_owner' | 'unknown' | 'unavailable' | 'hold_lapsed' | 'closed' | 'rate_limited';

/** Hub SQLSTATEs raised by supabase/migrations/*_hub_booking_operations.sql. */
const REFUSALS: Record<string, { refusal: HoldRefusal; status: number; message: string }> = {
  HB400: { refusal: 'invalid', status: 400, message: 'That booking request is not valid.' },
  HB403: { refusal: 'not_owner', status: 403, message: 'This hold belongs to someone else.' },
  HB404: { refusal: 'unknown', status: 404, message: 'That space or price is no longer available to book.' },
  HB409: { refusal: 'unavailable', status: 409, message: 'Someone has just taken this for that time. Choose another time or space.' },
  HB410: { refusal: 'hold_lapsed', status: 410, message: 'Your hold ran out before payment started. Choose the time again.' },
  HB423: { refusal: 'closed', status: 423, message: 'This space is closed for that time.' },
  HB429: { refusal: 'rate_limited', status: 429, message: 'Too many booking attempts. Please wait a moment and try again.' },
};

/**
 * Map a database error (supabase-js PostgrestError or node-postgres, both carry `code`) to a
 * refusal the visitor can act on. Anything else is a server fault and returns null.
 */
export function holdRefusal(error: unknown): { refusal: HoldRefusal; status: number; message: string } | null {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' ? (REFUSALS[code] ?? null) : null;
}
