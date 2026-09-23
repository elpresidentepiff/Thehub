import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { DEVELOPMENT_CATALOGUE } from './catalogue.ts';
import { quote } from './pricing.ts';
import {
  checkoutSessionParams,
  eventRecord,
  SESSION_MINUTES,
  verifyStripeSignature,
  webhookAction,
  type CheckoutInput,
  type StripeEvent,
} from './stripe.ts';
import { NOW, registry } from './test-fixtures.ts';

const HOLD = '6f1c2b1e-8a4d-4c55-9f0e-2d7b3a9c1e42';
const PRICE_ROW = '0b7e5d2a-3c41-4f8e-a6b9-1d2c3e4f5a6b';
const CUSTOMER = 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f';

const roomQuote = (() => {
  const r = quote(
    {
      unitId: 'L2-MR01',
      productId: 'meeting_room_small_hire',
      period: { start: new Date('2026-09-25T09:00:00Z'), end: new Date('2026-09-25T11:00:00Z') },
      addOns: [{ id: 'room_refreshments', quantity: 1 }],
    },
    { registry, catalogue: DEVELOPMENT_CATALOGUE, now: NOW },
  );
  assert.ok(r.ok);
  return r.quote;
})();

const input = (over: Partial<CheckoutInput> = {}): CheckoutInput => ({
  quote: roomQuote,
  holdId: HOLD,
  productPriceId: PRICE_ROW,
  stripePrices: { meeting_room_small_hire: 'price_devRoomSmall', room_refreshments: 'price_devRefresh' },
  environment: 'development',
  successUrl: 'http://localhost:3000/book/confirmed?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl: 'http://localhost:3000/book',
  now: NOW,
  ...over,
});

test('a Checkout Session is built from server-side prices and opaque ids only', () => {
  const { params, idempotencyKey, expiresAt } = checkoutSessionParams(input({ customerId: CUSTOMER, customerEmail: 'visitor@example.com' }));
  assert.equal(params.mode, 'payment');
  assert.deepEqual(params.line_items, [
    { price: 'price_devRoomSmall', quantity: 4 },
    { price: 'price_devRefresh', quantity: 1 },
  ]);
  assert.equal(params.client_reference_id, HOLD);
  assert.deepEqual(params.metadata, {
    hub_hold_id: HOLD,
    hub_product_price_id: PRICE_ROW,
    hub_environment: 'development',
    hub_customer_id: CUSTOMER,
  });
  assert.deepEqual(params.payment_intent_data.metadata, params.metadata);
  assert.ok(!JSON.stringify(params.metadata).includes('@'), 'no personal data in metadata');
  assert.equal(params.customer_email, 'visitor@example.com');
  assert.equal(params.customer_creation, 'always');
  assert.equal(idempotencyKey, `hub-checkout-${HOLD}`);
  // Stripe accepts 30 minutes to 24 hours.
  assert.equal(params.expires_at, NOW.getTime() / 1000 + SESSION_MINUTES * 60);
  assert.equal(expiresAt.getTime(), params.expires_at * 1000);
  assert.ok(SESSION_MINUTES >= 30 && SESSION_MINUTES <= 24 * 60);
});

test('Checkout refuses anything it cannot vouch for', () => {
  assert.throws(() => checkoutSessionParams(input({ stripePrices: { meeting_room_small_hire: 'price_devRoomSmall' } })), /no Stripe Price configured for room_refreshments/);
  assert.throws(() => checkoutSessionParams(input({ stripePrices: { meeting_room_small_hire: '3800', room_refreshments: 'price_x' } })), /no Stripe Price configured/);
  assert.throws(() => checkoutSessionParams(input({ holdId: 'L2-MR01' })), /holdId must be a reservation uuid/);
  assert.throws(() => checkoutSessionParams(input({ successUrl: 'http://localhost:3000/book/confirmed' })), /\{CHECKOUT_SESSION_ID\}/);
  assert.throws(() => checkoutSessionParams(input({ environment: 'preview' })), /must be https/);
  assert.throws(() => checkoutSessionParams(input({ cancelUrl: '/book' })), /not an absolute URL/);
  assert.doesNotThrow(() =>
    checkoutSessionParams(input({ environment: 'preview', successUrl: 'https://preview.example/b?s={CHECKOUT_SESSION_ID}', cancelUrl: 'https://preview.example/b' })),
  );
});

// --- webhooks -------------------------------------------------------------------------------

const SECRET = 'whsec_test_secret';
const sign = (body: string, t: number, secret = SECRET) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
const nowSec = NOW.getTime() / 1000;

test('webhook signatures are checked against the raw body', () => {
  const body = '{"id":"evt_1","type":"checkout.session.completed"}';
  const ok = { now: NOW };
  assert.deepEqual(verifyStripeSignature(body, sign(body, nowSec), SECRET, ok), { ok: true });
  assert.deepEqual(verifyStripeSignature(Buffer.from(body), sign(body, nowSec), SECRET, ok), { ok: true });
  // Stripe sends one v1 per active secret while a secret is being rolled.
  assert.deepEqual(verifyStripeSignature(body, `${sign(body, nowSec, 'whsec_old')},${sign(body, nowSec).split(',')[1]}`, SECRET, ok), { ok: true });
  assert.deepEqual(verifyStripeSignature(body.replace('evt_1', 'evt_2'), sign(body, nowSec), SECRET, ok), { ok: false, reason: 'no_match' });
  assert.deepEqual(verifyStripeSignature(body, sign(body, nowSec, 'whsec_other'), SECRET, ok), { ok: false, reason: 'no_match' });
  assert.deepEqual(verifyStripeSignature(body, sign(body, nowSec - 301), SECRET, ok), { ok: false, reason: 'stale' });
  assert.deepEqual(verifyStripeSignature(body, null, SECRET, ok), { ok: false, reason: 'missing_header' });
  assert.deepEqual(verifyStripeSignature(body, `t=${nowSec}`, SECRET, ok), { ok: false, reason: 'malformed_header' });
  assert.deepEqual(verifyStripeSignature(body, 'v1=abc,t=soon', SECRET, ok), { ok: false, reason: 'malformed_header' });
});

const session = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'cs_test_a1',
  object: 'checkout.session',
  mode: 'payment',
  payment_status: 'paid',
  client_reference_id: HOLD,
  amount_total: 9100,
  currency: 'gbp',
  customer: 'cus_T1',
  customer_details: { email: 'visitor@example.com', name: 'A Visitor' },
  payment_intent: 'pi_T1',
  metadata: { hub_hold_id: HOLD, hub_product_price_id: PRICE_ROW, hub_environment: 'development' },
  ...over,
});
const event = (type: string, object = session(), livemode = false): StripeEvent => ({ id: 'evt_1', type, livemode, data: { object } });

test('a paid session becomes one confirm action', () => {
  assert.deepEqual(webhookAction(event('checkout.session.completed'), 'development'), {
    kind: 'confirm',
    sessionId: 'cs_test_a1',
    holdId: HOLD,
    paymentIntentId: 'pi_T1',
    amountTotal: 9100,
    currency: 'gbp',
    customer: { email: 'visitor@example.com', name: 'A Visitor', stripeCustomerId: 'cus_T1', hubCustomerId: null },
  });
  const expanded = webhookAction(event('checkout.session.async_payment_succeeded', session({ customer: { id: 'cus_T2' }, payment_intent: { id: 'pi_T2' } })), 'development');
  assert.ok(expanded.kind === 'confirm' && expanded.customer.stripeCustomerId === 'cus_T2' && expanded.paymentIntentId === 'pi_T2');
  assert.deepEqual(eventRecord(event('checkout.session.completed')), { eventId: 'evt_1', type: 'checkout.session.completed', livemode: false, objectId: 'cs_test_a1' });
});

test('every other event is expire, ignore or reject, with a reason', () => {
  const cases: [StripeEvent, string, string?][] = [
    [event('checkout.session.expired'), 'expire'],
    [event('checkout.session.async_payment_failed'), 'expire'],
    [event('checkout.session.completed', session({ payment_status: 'unpaid' })), 'ignore', 'awaiting_async_payment'],
    [event('invoice.paid'), 'ignore', 'unhandled_event_type'],
    [event('checkout.session.completed', session({ metadata: {} })), 'ignore', 'not_a_hub_session'],
    [event('checkout.session.completed', session({ metadata: { hub_hold_id: HOLD, hub_environment: 'preview' } })), 'ignore', 'other_environment'],
    [event('checkout.session.completed', session({ mode: 'subscription' })), 'ignore', 'subscriptions_not_live'],
    [event('checkout.session.completed', session(), true), 'reject', 'livemode_mismatch'],
    [event('checkout.session.completed', session({ client_reference_id: CUSTOMER })), 'reject', 'hold_reference_mismatch'],
    [event('checkout.session.completed', session({ id: 'pi_wrong' })), 'reject', 'missing_session_id'],
    [event('checkout.session.completed', session({ customer_details: { email: null } })), 'reject', 'paid_without_email'],
    [event('checkout.session.completed', session({ amount_total: null })), 'reject', 'paid_without_amount'],
  ];
  for (const [e, kind, reason] of cases) {
    const action = webhookAction(e, 'development');
    assert.equal(action.kind, kind, `${e.type} → ${kind} ${reason ?? ''}`);
    if (reason) assert.equal((action as { reason: string }).reason, reason);
  }
  assert.deepEqual(webhookAction(event('checkout.session.completed', session()), 'production'), { kind: 'reject', reason: 'livemode_mismatch' });
});
