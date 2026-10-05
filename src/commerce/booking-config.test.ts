import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingConfig, canCreateBookings, canReadAvailability } from './booking-config.ts';

test('booking connection is off when no environment is configured', () => {
  const config = bookingConfig({});
  assert.equal(config.mode, 'off');
  assert.equal(canReadAvailability(config), false);
  assert.equal(canCreateBookings(config), false);
});

test('availability mode requires both server credentials', () => {
  assert.throws(() => bookingConfig({ HUB_BOOKING_MODE: 'availability' }), /requires SUPABASE_URL/);
  assert.throws(() => bookingConfig({ HUB_BOOKING_MODE: 'availability', SUPABASE_URL: 'https://example.supabase.co' }), /requires SUPABASE_URL/);
});

test('availability and booking modes have separate capabilities', () => {
  const base = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' };
  const read = bookingConfig({ ...base, HUB_BOOKING_MODE: 'availability' });
  const write = bookingConfig({
    ...base,
    HUB_BOOKING_MODE: 'booking',
    HUB_RATE_LIMIT_PROVIDER: 'database',
    HUB_RATE_LIMIT_HMAC_SECRET: 'a-secure-test-secret-with-32-characters',
    HUB_TRUSTED_PROXY_HEADER: 'x-vercel-forwarded-for',
  });
  assert.equal(canReadAvailability(read), true);
  assert.equal(canCreateBookings(read), false);
  assert.equal(canCreateBookings(write), true);
});

test('invalid modes, URLs and public keys fail closed', () => {
  assert.throws(() => bookingConfig({ HUB_BOOKING_MODE: 'live' }), /must be off/);
  assert.throws(() => bookingConfig({ HUB_BOOKING_MODE: 'booking', SUPABASE_URL: 'ftp://example.test', SUPABASE_SECRET_KEY: 'secret' }), /http\(s\)/);
  assert.throws(() => bookingConfig({ HUB_BOOKING_MODE: 'booking', SUPABASE_URL: 'https://example.test', SUPABASE_SECRET_KEY: 'sb_publishable_x' }), /server secret key/);
});

test('plain HTTP is limited to a loopback Supabase URL in development', () => {
  const key = { HUB_BOOKING_MODE: 'availability', SUPABASE_SECRET_KEY: 'sb_secret_test' };
  assert.equal(bookingConfig({ ...key, SUPABASE_URL: 'http://127.0.0.1:54321', HUB_ENV: 'development' }).supabaseUrl, 'http://127.0.0.1:54321');
  assert.throws(() => bookingConfig({ ...key, SUPABASE_URL: 'http://database.internal', HUB_ENV: 'development' }), /HTTPS/);
  assert.throws(() => bookingConfig({ ...key, SUPABASE_URL: 'http://localhost:54321', HUB_ENV: 'preview' }), /HTTPS/);
  assert.throws(() => bookingConfig({ ...key, SUPABASE_URL: 'http://localhost:54321', HUB_ENV: 'production' }), /HTTPS/);
});

test('booking mode cannot enable without a deployment-safe abuse-control contract', () => {
  const base = { HUB_BOOKING_MODE: 'booking', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' };
  assert.throws(() => bookingConfig(base), /RATE_LIMIT_PROVIDER/);
  assert.throws(() => bookingConfig({ ...base, HUB_RATE_LIMIT_PROVIDER: 'database' }), /HMAC_SECRET/);
  assert.throws(() => bookingConfig({ ...base, HUB_RATE_LIMIT_PROVIDER: 'database', HUB_RATE_LIMIT_HMAC_SECRET: 'short' }), /32\+/);
  assert.throws(() => bookingConfig({ ...base, HUB_RATE_LIMIT_PROVIDER: 'database', HUB_RATE_LIMIT_HMAC_SECRET: 'a-secure-test-secret-with-32-characters' }), /TRUSTED_PROXY_HEADER/);
});
