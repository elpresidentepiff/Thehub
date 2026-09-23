/**
 * Stripe, without the SDK: the exact parameters for a Checkout Session, webhook signature
 * checks, and a pure reducer that turns a verified event into one database operation.
 *
 * Nothing here calls Stripe or the database. Route handlers do that (C3), and only after the
 * operator approves docs/commerce/STRIPE_OBJECT_MAPPING.md (ROADMAP D4).
 *
 * The hold is the reservation row (status 'held'), so `hub_hold_id` names both; no separate
 * `hub_reservation_id` is sent.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { HubEnvironment } from './env.ts';
import type { Quote } from './pricing.ts';

/** Stripe accepts expires_at 30 minutes to 24 hours after creation; the shortest keeps slots moving. */
export const SESSION_MINUTES = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PRICE = /^price_[A-Za-z0-9]+$/;

export interface CheckoutInput {
  quote: Quote;
  /** hub.reservations.id of the live hold. */
  holdId: string;
  /** hub.product_prices.id backing the booking offer. */
  productPriceId: string;
  /** Stripe Price ids from server configuration, keyed by quote line id. Never from the browser. */
  stripePrices: Readonly<Record<string, string>>;
  environment: HubEnvironment;
  /** Must contain {CHECKOUT_SESSION_ID}: the confirmation page reads state back from the server. */
  successUrl: string;
  cancelUrl: string;
  /** hub.customers.id when the visitor is signed in. */
  customerId?: string;
  customerEmail?: string;
  now: Date;
}

export interface CheckoutSessionParams {
  mode: 'payment';
  line_items: { price: string; quantity: number }[];
  client_reference_id: string;
  expires_at: number;
  success_url: string;
  cancel_url: string;
  customer_creation: 'always';
  customer_email?: string;
  metadata: Record<string, string>;
  payment_intent_data: { metadata: Record<string, string> };
}

function returnUrl(url: string, environment: HubEnvironment, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${name} is not an absolute URL`);
  }
  const local = parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
  if (parsed.protocol !== 'https:' && !(local && environment === 'development')) {
    throw new Error(`${name} must be https (http://localhost only in development)`);
  }
  return url;
}

export function checkoutSessionParams(input: CheckoutInput): {
  params: CheckoutSessionParams;
  idempotencyKey: string;
  expiresAt: Date;
} {
  const { quote, holdId, environment } = input;
  if (!UUID.test(holdId)) throw new Error('holdId must be a reservation uuid');
  if (!UUID.test(input.productPriceId)) throw new Error('productPriceId must be a product_prices uuid');
  if (input.customerId !== undefined && !UUID.test(input.customerId)) throw new Error('customerId must be a customers uuid');
  if (!input.successUrl.includes('{CHECKOUT_SESSION_ID}')) throw new Error('successUrl must carry {CHECKOUT_SESSION_ID}');

  const line_items = quote.lines.map((line) => {
    const price = input.stripePrices[line.id];
    if (!price || !PRICE.test(price)) throw new Error(`no Stripe Price configured for ${line.id}`);
    return { price, quantity: line.quantity };
  });

  const metadata: Record<string, string> = {
    hub_hold_id: holdId,
    hub_product_price_id: input.productPriceId,
    hub_environment: environment,
    ...(input.customerId ? { hub_customer_id: input.customerId } : {}),
  };
  const expiresAt = new Date(input.now.getTime() + SESSION_MINUTES * 60_000);

  return {
    params: {
      mode: 'payment',
      line_items,
      client_reference_id: holdId,
      expires_at: Math.floor(expiresAt.getTime() / 1000),
      success_url: returnUrl(input.successUrl, environment, 'successUrl'),
      cancel_url: returnUrl(input.cancelUrl, environment, 'cancelUrl'),
      customer_creation: 'always',
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
      metadata,
      payment_intent_data: { metadata },
    },
    // One session per hold: a retried request returns the same session instead of a second one.
    idempotencyKey: `hub-checkout-${holdId}`,
    expiresAt,
  };
}

// -----------------------------------------------------------------------------------------
// Webhooks
// -----------------------------------------------------------------------------------------

export type SignatureCheck = { ok: true } | { ok: false; reason: 'missing_header' | 'malformed_header' | 'stale' | 'no_match' };

/**
 * Verify a Stripe-Signature header against the raw request body, as Stripe documents:
 * HMAC-SHA256 of `${t}.${body}` keyed with the endpoint secret, compared with every v1.
 */
export function verifyStripeSignature(
  rawBody: string | Uint8Array,
  header: string | null | undefined,
  secret: string,
  opts: { now: Date; toleranceSeconds?: number },
): SignatureCheck {
  if (!header) return { ok: false, reason: 'missing_header' };
  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') timestamp = /^\d+$/.test(value) ? Number(value) : Number.NaN;
    if (key === 'v1' && /^[0-9a-f]{64}$/.test(value)) signatures.push(value);
  }
  if (timestamp === undefined || !Number.isFinite(timestamp) || !signatures.length) return { ok: false, reason: 'malformed_header' };
  if (Math.abs(opts.now.getTime() / 1000 - timestamp) > (opts.toleranceSeconds ?? 300)) return { ok: false, reason: 'stale' };

  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();
  const match = signatures.some((sig) => timingSafeEqual(Buffer.from(sig, 'hex'), expected));
  return match ? { ok: true } : { ok: false, reason: 'no_match' };
}

/** The fields of a Stripe event this reducer reads. Everything else is ignored. */
export interface StripeEvent {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: Record<string, unknown> };
}

export type WebhookAction =
  | {
      kind: 'confirm';
      sessionId: string;
      holdId: string;
      paymentIntentId: string | null;
      amountTotal: number;
      currency: string;
      customer: { email: string; name: string | null; stripeCustomerId: string | null; hubCustomerId: string | null };
    }
  | { kind: 'expire'; sessionId: string }
  /** Not ours, or nothing to do. Acknowledge with 2xx. */
  | { kind: 'ignore'; reason: string }
  /** Ours but wrong: acknowledge, record the reason on the event, and alert. */
  | { kind: 'reject'; reason: string };

/** Arguments for private.record_stripe_event, so every delivery is logged before it acts. */
export function eventRecord(event: StripeEvent): { eventId: string; type: string; livemode: boolean; objectId: string | null } {
  const id = event.data.object.id;
  return { eventId: event.id, type: event.type, livemode: event.livemode, objectId: typeof id === 'string' ? id : null };
}

const text = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
/** Expandable Stripe fields arrive as an id string or as the expanded object. */
const ref = (v: unknown): string | null =>
  text(v) ?? (typeof v === 'object' && v !== null ? text((v as { id?: unknown }).id) : null);

export function webhookAction(event: StripeEvent, environment: HubEnvironment): WebhookAction {
  if (!event.type.startsWith('checkout.session.')) return { kind: 'ignore', reason: 'unhandled_event_type' };

  const session = event.data.object;
  const metadata = (typeof session.metadata === 'object' && session.metadata !== null ? session.metadata : {}) as Record<string, unknown>;
  const holdId = text(metadata.hub_hold_id);
  if (!holdId) return { kind: 'ignore', reason: 'not_a_hub_session' };
  // Live money at a test deployment (or the reverse) is a misconfiguration, whoever it belongs to.
  if (event.livemode !== (environment === 'production')) return { kind: 'reject', reason: 'livemode_mismatch' };
  // Test mode is shared by development and preview; each deployment acts only on its own sessions.
  if (metadata.hub_environment !== environment) return { kind: 'ignore', reason: 'other_environment' };

  const sessionId = text(session.id);
  if (!sessionId?.startsWith('cs_')) return { kind: 'reject', reason: 'missing_session_id' };
  if (session.mode !== 'payment') return { kind: 'ignore', reason: 'subscriptions_not_live' };
  if (session.client_reference_id !== holdId) return { kind: 'reject', reason: 'hold_reference_mismatch' };

  switch (event.type) {
    case 'checkout.session.completed':
      // Delayed methods complete as 'unpaid' and settle later in async_payment_succeeded.
      if (session.payment_status !== 'paid') return { kind: 'ignore', reason: 'awaiting_async_payment' };
      break;
    case 'checkout.session.async_payment_succeeded':
      break;
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed':
      return { kind: 'expire', sessionId };
    default:
      return { kind: 'ignore', reason: 'unhandled_event_type' };
  }

  const details = (typeof session.customer_details === 'object' && session.customer_details !== null
    ? session.customer_details
    : {}) as Record<string, unknown>;
  const email = text(details.email);
  const amountTotal = session.amount_total;
  const currency = text(session.currency);
  if (!email) return { kind: 'reject', reason: 'paid_without_email' };
  if (typeof amountTotal !== 'number' || !Number.isInteger(amountTotal) || amountTotal < 0 || !currency) {
    return { kind: 'reject', reason: 'paid_without_amount' };
  }

  return {
    kind: 'confirm',
    sessionId,
    holdId,
    paymentIntentId: ref(session.payment_intent),
    amountTotal,
    currency,
    customer: {
      email,
      name: text(details.name),
      stripeCustomerId: ref(session.customer),
      hubCustomerId: text(metadata.hub_customer_id),
    },
  };
}
