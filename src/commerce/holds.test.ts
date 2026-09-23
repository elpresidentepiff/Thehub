import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashOwnerToken, holdRefusal, newOwnerToken } from './holds.ts';

test('owner tokens are random; only their hash fits the database column', () => {
  const a = newOwnerToken();
  const b = newOwnerToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  const hash = hashOwnerToken(a);
  assert.match(hash, /^[0-9a-f]{64}$/); // hub.reservations.owner_token_hash check
  assert.equal(hashOwnerToken(a), hash);
  assert.notEqual(hashOwnerToken(b), hash);
  assert.throws(() => hashOwnerToken(hash), /not a hold owner token/); // a hash is not a token
  assert.throws(() => hashOwnerToken(''), /not a hold owner token/);
});

test('database refusals map to statuses and words the visitor can act on', () => {
  assert.deepEqual(holdRefusal({ code: 'HB409', message: 'unit L2-D001 is not available' }), {
    refusal: 'unavailable',
    status: 409,
    message: 'Someone has just taken this for that time. Choose another time or space.',
  });
  assert.deepEqual(
    ['HB400', 'HB403', 'HB404', 'HB410', 'HB423'].map((code) => holdRefusal({ code })?.status),
    [400, 403, 404, 410, 423],
  );
  assert.equal(holdRefusal({ code: '23505' }), null); // a real fault stays a 500
  assert.equal(holdRefusal(new Error('boom')), null);
  assert.equal(holdRefusal(null), null);
});
