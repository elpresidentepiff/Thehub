# Hub Stripe object mapping proposal

Status: proposal only. No Stripe Product, Price, Checkout Session, webhook or live/test-mode
resource has been created.

Reviewed against Stripe documentation on 23 September 2026.

## Authority boundary

- Stripe is authoritative for payments, invoices and subscription lifecycle.
- Hub Postgres is authoritative for spaces, inventory, availability, reservation identity,
  operational booking state and entitlement consumption.
- Stripe object IDs are references, not replacements for stable Hub IDs.
- Raw card data never reaches or enters the Hub database.
- The browser never selects an authoritative amount or Stripe Price ID.

## Object map

| Hub concept | Stripe object | Notes |
| --- | --- | --- |
| Customer | Customer | Store Stripe Customer ID on `hub.customers`; avoid duplicates by idempotent server lookup/create |
| Day pass / hot-desk booking | Product + one-time Price | Checkout Session in `payment` mode; reservation ID and hold ID in controlled metadata |
| Meeting-room booking | Product + one-time/dynamic approved Price strategy | Exact pricing method awaits duration rules; never accept browser amount |
| Event-space deposit/full hire | Product + one-time Price | Deposit/balance rules require approval before implementation |
| Dedicated desk membership | Product + recurring Price | Checkout Session in `subscription` mode where appropriate |
| Private-office membership | Product + recurring Price or sales-assisted contract | Commercial policy determines self-serve versus enquiry |
| Membership tier | Product + recurring Price | Stripe Subscription mirrors billing lifecycle; Hub membership stores operational entitlements |
| Credit/package purchase | Product + one-time Price | Successful event grants append-only Hub credits idempotently |
| Add-on | Product/Price and Checkout line item | Hub reservation add-on stores quantity and immutable snapshot |
| Payment attempt | Checkout Session | Create a new server-side Session per attempt; associate one active hold |
| One-time money movement | PaymentIntent | Referenced from completed Checkout Session where applicable |
| Recurring billing | Subscription + Invoice | Provision/revoke according to verified subscription/invoice events and approved policy |
| Refund | Refund | Hub reservation/payment audit mirrors result; operational cancellation is separate |

## Checkout metadata contract

Set server-controlled metadata only, with opaque identifiers:

- `hub_hold_id`
- `hub_reservation_id` when already allocated safely
- `hub_customer_id`
- `hub_product_price_id`
- `hub_environment` (`development`, `preview`, `production`)

Do not place emails, names, addresses or sensitive booking detail in metadata. Do not rely on
metadata as the only integrity check; load the Hub records and validate their relationships.

## One-time booking flow

1. Server quotes availability and approved price.
2. Server atomically acquires an expiring hold.
3. Server creates a new Checkout Session in `payment` mode from the approved mapping.
4. Server stores the Session ID on the hold.
5. Customer completes Stripe-hosted/embedded Checkout.
6. Verified webhook event enters the idempotent event ledger.
7. Server locks and converts the valid hold to a reservation.
8. Availability notification is published.
9. Success page retrieves server-confirmed state; it never fulfills the booking itself.

Handle at least:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- Relevant refund events once cancellation rules are approved

## Subscription flow

1. Server selects approved recurring Price and creates Checkout Session in `subscription` mode.
2. Verified events associate the Stripe Customer and Subscription with the Hub customer.
3. Access/benefits are provisioned only according to approved subscription/invoice policy.
4. `invoice.paid` and subscription lifecycle events update the Hub mirror idempotently.
5. `past_due`, `unpaid`, `paused`, cancelled and incomplete states follow documented commercial
   rules; do not equate every non-active value with the same customer outcome.

Stripe may generate Invoices and PaymentIntents as part of subscription collection. The Hub
must retain the Stripe object links required for support and reconciliation.

## Development product policy

- Development products live in Stripe test mode only.
- Every test Product/Price uses a clear `DEV — Hub` prefix and environment metadata.
- Test Price IDs are supplied through server configuration, not scattered through frontend code.
- Preview and production deployments fail closed if mock/test IDs are configured incorrectly.
- No production catalogue is created until real pricing, VAT, deposit, cancellation and billing
  rules are approved.

## Webhook requirements

- Verify Stripe signatures against the raw request body.
- Record Stripe event ID before processing; duplicate delivery becomes a safe no-op/reconcile.
- Keep business transitions idempotent and transactional.
- Check object livemode/environment before mutation.
- Do not assume event order.
- Retrieve authoritative Stripe state when an event is incomplete or out of order.
- Alert on repeated failures and retain a replay/reconciliation runbook.

## Approval questions

1. Which offers are one-time payments, deposits, recurring subscriptions or enquiry-only?
2. Are room prices fixed by duration or calculated from approved server-side rules?
3. Is VAT included in displayed pricing? **Yes** — see [`PRICING.md`](./PRICING.md).
4. What is refundable, until when, and who may override cancellation?
5. Which subscription states retain access and for how long during failed payment recovery?
6. Are credits/packages transferable, refundable or expiring?
7. Do private offices require contracts outside self-serve Checkout?
8. Which communications are sent by Stripe versus the Hub?

## Documentation used

- Checkout Sessions: https://docs.stripe.com/api/checkout/sessions
- Checkout: https://docs.stripe.com/payments/checkout
- Subscription lifecycle: https://docs.stripe.com/billing/subscriptions/overview
- Subscription webhooks: https://docs.stripe.com/billing/subscriptions/webhooks
- Webhook signature verification: https://docs.stripe.com/webhooks#verify-events

