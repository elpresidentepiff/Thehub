import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertDevelopment, assertNotProduction, hubEnvironment } from './env.ts';

test('HUB_ENV wins; otherwise NODE_ENV=production fails closed to production', () => {
  assert.equal(hubEnvironment({ HUB_ENV: 'preview', NODE_ENV: 'production' }), 'preview');
  assert.equal(hubEnvironment({ NODE_ENV: 'production' }), 'production');
  assert.equal(hubEnvironment({ NODE_ENV: 'development' }), 'development');
  assert.equal(hubEnvironment({}), 'development');
  assert.throws(() => hubEnvironment({ HUB_ENV: 'prod' }), /HUB_ENV must be/);
});

test('dev-only guards', () => {
  assert.throws(() => assertNotProduction('Seed', { NODE_ENV: 'production' }), /cannot run in production/);
  assert.doesNotThrow(() => assertNotProduction('Seed', { HUB_ENV: 'preview' }));
  assert.throws(() => assertDevelopment('Mock', { HUB_ENV: 'preview' }), /only in development \(this is preview\)/);
  assert.doesNotThrow(() => assertDevelopment('Mock', {}));
});
