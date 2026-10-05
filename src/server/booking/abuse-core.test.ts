import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingAbuseBuckets, networkAddress } from './abuse-core.ts';

test('trusted proxy values accept only an IP address', () => {
  assert.equal(networkAddress('203.0.113.9'), '203.0.113.9');
  assert.equal(networkAddress('2001:db8::1'), '2001:db8::1');
  assert.equal(networkAddress('203.0.113.9, 10.0.0.1'), '203.0.113.9');
  assert.equal(networkAddress('attacker.example'), null);
  assert.equal(networkAddress(null), null);
});

test('rate-limit buckets are stable HMACs and reveal neither owner nor address', () => {
  const input = { ownerTokenHash: 'a'.repeat(64), networkAddress: '203.0.113.9', secret: 'test-secret-that-is-at-least-32-characters' };
  const one = bookingAbuseBuckets(input);
  const two = bookingAbuseBuckets(input);
  assert.deepEqual(one, two);
  assert.match(one.actorBucket, /^[0-9a-f]{64}$/);
  assert.match(one.networkBucket, /^[0-9a-f]{64}$/);
  assert.notEqual(one.actorBucket, one.networkBucket);
  assert.doesNotMatch(JSON.stringify(one), /203\.0\.113\.9|a{20}/);
});
