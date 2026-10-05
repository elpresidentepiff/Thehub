/** Runtime switch for the real booking connection. Missing configuration fails closed. */
export type BookingMode = 'off' | 'availability' | 'booking';

export interface BookingConfig {
  mode: BookingMode;
  supabaseUrl: string | null;
  supabaseSecretKey: string | null;
  rateLimitProvider: 'database' | null;
  rateLimitHmacSecret: string | null;
  trustedProxyHeader: 'x-vercel-forwarded-for' | 'cf-connecting-ip' | null;
}

const MODES = new Set<BookingMode>(['off', 'availability', 'booking']);
const optional = (env: Record<string, string | undefined>, name: string): string | null => env[name]?.trim() || null;

export function bookingConfig(env: Record<string, string | undefined> = process.env): BookingConfig {
  const rawMode = optional(env, 'HUB_BOOKING_MODE') ?? 'off';
  if (!MODES.has(rawMode as BookingMode)) {
    throw new Error(`HUB_BOOKING_MODE must be off, availability or booking (got "${rawMode}")`);
  }
  const mode = rawMode as BookingMode;
  const supabaseUrl = optional(env, 'SUPABASE_URL');
  const supabaseSecretKey = optional(env, 'SUPABASE_SECRET_KEY');
  const rateLimitProvider = optional(env, 'HUB_RATE_LIMIT_PROVIDER');
  const rateLimitHmacSecret = optional(env, 'HUB_RATE_LIMIT_HMAC_SECRET');
  const trustedProxyHeader = optional(env, 'HUB_TRUSTED_PROXY_HEADER');
  if (mode !== 'off') {
    if (!supabaseUrl || !supabaseSecretKey) {
      throw new Error(`HUB_BOOKING_MODE=${mode} requires SUPABASE_URL and SUPABASE_SECRET_KEY`);
    }
    let url: URL;
    try { url = new URL(supabaseUrl); } catch { throw new Error('SUPABASE_URL must be an absolute http(s) URL'); }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('SUPABASE_URL must be an absolute http(s) URL');
    const environment = env.HUB_ENV ?? (env.NODE_ENV === 'production' ? 'production' : 'development');
    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if (url.protocol === 'http:' && (environment !== 'development' || !loopback)) {
      throw new Error('SUPABASE_URL must use HTTPS outside local development');
    }
    if (/^(?:sb_publishable_|eyJ)/.test(supabaseSecretKey)) {
      throw new Error('SUPABASE_SECRET_KEY must be a server secret key, not a publishable or legacy anon key');
    }
  }
  if (mode === 'booking') {
    if (rateLimitProvider !== 'database') throw new Error('HUB_BOOKING_MODE=booking requires HUB_RATE_LIMIT_PROVIDER=database');
    if (!rateLimitHmacSecret || rateLimitHmacSecret.length < 32) {
      throw new Error('HUB_BOOKING_MODE=booking requires a 32+ character HUB_RATE_LIMIT_HMAC_SECRET');
    }
    if (trustedProxyHeader !== 'x-vercel-forwarded-for' && trustedProxyHeader !== 'cf-connecting-ip') {
      throw new Error('HUB_BOOKING_MODE=booking requires an explicit supported HUB_TRUSTED_PROXY_HEADER');
    }
  }
  return {
    mode,
    supabaseUrl,
    supabaseSecretKey,
    rateLimitProvider: rateLimitProvider === 'database' ? rateLimitProvider : null,
    rateLimitHmacSecret,
    trustedProxyHeader: trustedProxyHeader === 'x-vercel-forwarded-for' || trustedProxyHeader === 'cf-connecting-ip' ? trustedProxyHeader : null,
  };
}

export const canReadAvailability = (config: BookingConfig): boolean => config.mode !== 'off';
export const canCreateBookings = (config: BookingConfig): boolean => config.mode === 'booking';
