# Commerce and spatial floor workstream

Status: architecture brief. Report schema and Stripe mapping for approval before creating
production tables, products or prices.

Companion architecture proposals:

- [`SUPABASE_SCHEMA_PROPOSAL.md`](./SUPABASE_SCHEMA_PROPOSAL.md) — Hub-owned operational data, access boundaries, booking holds and overlap protection.
- [`STRIPE_OBJECT_MAPPING.md`](./STRIPE_OBJECT_MAPPING.md) — Stripe products, prices, Checkout, subscriptions, webhooks and metadata.

## Product sequence

```text
Floor map
→ space / bookable unit
→ availability
→ selection
→ basket
→ Stripe Checkout
→ booking
→ confirmation
```

The commerce engine is independent of the visual renderer. The same inventory should later
power the website, a mobile experience, an operational concierge and a spatial/3D scene.

## Stable identity contract

Every bookable unit receives a durable ID, for example:

```text
L2-D001       dedicated or hot desk
L2-MR01       meeting room
L2-OFFICE03   private office
L2-EVENT01    event space
```

SVG overlays, photographs, videos, splats and 3D objects may reference these IDs. They do
not own availability, pricing, customers or reservations. A new plan drawing must never
invalidate historical bookings.

## Customer-facing floor states

| State | Meaning | Visual intention |
| --- | --- | --- |
| Available | Can be selected for the requested period | Subtle warm pulse |
| Selected | In the current basket/selection | Illuminated Hub accent |
| Held | Temporarily protected by another valid checkout | Quietly unavailable |
| Occupied / unavailable | Cannot be bought for the requested period | Subdued |
| Your booking | Belongs to the signed-in customer for that period | Strong, unmistakable marker |

Do not expose occupant names in public availability data.

## Selection card contract

A selected asset may show:

- Real photograph or video.
- Name and stable number.
- Type and capacity.
- Amenities.
- Availability for the requested period.
- Approved price and billing basis.
- One clear selection action.

Touch behavior is first-class. A list/table alternative must expose the same inventory as
the spatial map.

## Proposed Supabase domains

Report the detailed migration design before creating production resources. Expected domains:

- `floors` and plan revisions.
- `spaces` for rooms, areas and commercial groupings.
- `bookable_units` for stable desks, rooms, offices and event spaces.
- `media` associations by stable ID.
- `availability_rules` and closures.
- `reservation_holds` with authoritative expiry.
- `reservations` with time range and commercial state.
- `customers` linked to authentication and Stripe IDs.
- `membership_products`, `memberships` and credits/packages.
- `products`, price references and add-ons.
- `events` and event-space inventory when in scope.
- `payment_events` for idempotent webhook processing and audit.

RLS and grants must be tested for anonymous, authenticated, operator and service roles.
Server-side locking must prevent overlapping purchases of the same bookable unit.

## Stripe responsibility

- Stripe is authoritative for money and subscription state.
- Supabase records operational booking and membership state plus Stripe object references.
- Never store raw card data.
- Prices sent to Checkout are selected server-side from approved mappings, never trusted from the browser.
- Webhooks are signature-verified and idempotent.
- The success redirect is not fulfillment.
- Development products may be used before pricing is final; temporary prices must never be embedded throughout the frontend or promoted to production accidentally.

## Development laboratories

Planned development routes:

- `/lab/floor` — measured plan, stable overlays, touch/keyboard states and mock data.
- `/lab/booking` — date/time, unit selection, basket and contention behavior.
- `/lab/checkout` — Stripe test-mode session and webhook state transitions.

Mock availability is permitted only in clearly labelled development routes. It must be
impossible to enable in production by mistake.

## Experience bridge

After the arrival experience is approved, test whether the camera can rise from the real
floor into the measured top-down plan. The plan becomes the bridge from film to product.

Later, the same stable ID can connect both directions:

```text
Select L2-MR03 in the plan
→ show its real media and availability
→ optionally descend to the same room in a verified Gaussian-splat/spatial scene
```

The booking system must not depend on the cinematic transition or the spatial renderer.

## Explicit non-goals for the first product pass

- No generic SaaS booking dashboard as the customer-facing experience.
- No live pricing or product creation before approval.
- No mock availability in production.
- No payment implementation before the object mapping and reservation lock are reviewed.
- No commercial state encoded into SVG colours or hard-coded React objects.
- No dependency on an unfinished opening sequence.
