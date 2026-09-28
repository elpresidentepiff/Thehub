# Hub Supabase schema proposal

Status: **proposal, implemented as local migrations for review.** No Supabase project exists.
Nothing has been applied to any remote database. Approval (ROADMAP D3) is what creates the
dedicated Hub project.

Reviewed against Supabase documentation and changelog on 23 September 2026.

## Implementation status (23 Sep)

The proposal below is now real SQL in `supabase/migrations/`, proven by `npm run db:test`
on a throwaway local Postgres 16 (Supabase runs 17; nothing used is version-specific):

| Check | Result |
| --- | --- |
| Migrations apply cleanly, in order, each in one transaction | 3/3 |
| Real registry (`data/inventory/unit4-l2.json`) seeds, twice (idempotent) | 19 desks, 4 rooms/offices |
| Structural guarantees (`01_structure.test.sql`) | 12/12 |
| Booking behaviour (`02_booking.test.sql`) | 35/35 |
| Who can see and do what (`03_access.test.sql`) | 21/21 |
| 24 concurrent sessions, identical period, one desk | exactly 1 hold |
| 40 concurrent sessions, random overlapping periods | 0 overlapping rows |
| Negative control: same suite with the exclusion constraint removed | fails (24/24 sessions got the desk) |

### Where the implementation departs from the proposal, and why

1. **A hold is a reservation in state `held`, not a row in a separate table.** One table,
   one GiST exclusion constraint over `(unit_id, during)` for `held` and `confirmed` rows.
   Two tables need a lock discipline across both to stay correct; one table makes double
   booking impossible even for a raw `INSERT` that skips every function (tested).
2. **No `security definer` anywhere.** Every operation is a `security invoker` function in
   `private`, with `search_path = ''`, executable only by `service_role`.
3. **The Data API exposes only four read-only views** in `api`: `floors`, `units`,
   `unit_media` (anon + authenticated) and `my_reservations` (authenticated, own rows only).
   Availability, holds and payments go through the Next.js server, never the Data API.
4. **Hold length.** A hold starts at 10 minutes (browsing extras). Attaching a Stripe
   Checkout Session stretches it past the session's expiry. Stripe Checkout Sessions cannot
   expire sooner than 30 minutes, so the build plan's fixed 10-minute hold would have let
   a visitor pay for a slot that had already lapsed.
5. **Paid after the hold lapsed.** If the slot is still free, the booking stands
   (`confirmed_after_expiry`). If someone else took it, the row is flagged `needs_refund`
   and stays unbooked (`conflict_refund_required`). It is never double-booked.
6. **Operators** are authenticated users with `app_metadata.hub_role = 'operator'`
   (server-controlled). `user_metadata` cannot grant it (tested).
7. **Errors carry Hub SQLSTATEs** (`HB400` bad request, `HB403` not owner, `HB404` unknown or
   not bookable, `HB409` unavailable, `HB410` hold gone, `HB423` closed) so the server maps
   them without parsing text.
8. Open decisions stay out of the schema: opening hours, durations and buffers (D9) live in
   `src/commerce/catalogue.ts` as development values; the database enforces only what is
   certain (no overlap, valid ranges, closures, ownership).

`events` and `availability_rules` tables are not built yet. They wait on D9 and D10.

## Platform boundary

Create a dedicated Hub Supabase project when this proposal is approved. Do not use or
extend any VELO database or project.

Use three schema layers:

| Schema | Exposure | Responsibility |
| --- | --- | --- |
| `api` | Deliberately exposed through the Data API | Narrow read models and explicitly callable operations |
| `hub` | Not exposed | Inventory, availability, holds, reservations, memberships and operational data |
| `private` | Not exposed | Payment event ledger, privileged helpers and audit internals |

Do not put `security definer` functions in an exposed schema. Prefer `security invoker`.
If a privileged helper is unavoidable, keep it private, set `search_path = ''`, fully
qualify every relation and grant execute only to the server role that needs it.

## Identity and authorisation

- `auth.users.id` is the sign-in identity.
- `hub.customers.user_id` optionally links an operational customer to a signed-in user.
- Roles/permissions belong in controlled application metadata or relational tables, never
  user-editable `user_metadata`.
- Publishable credentials may reach only the intended `api` surface.
- Service/secret credentials remain server-side and never use a `NEXT_PUBLIC_` variable.
- Every exposed table/view/function receives explicit grants and RLS tests.
- Views exposed to clients use `security_invoker = true` where supported.

## Core entities

### `hub.floors`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Stable code such as `unit4-l2` |
| `name` | text | Operator-facing name |
| `plan_revision` | text | Such as `rev-b` |
| `width_m`, `height_m` | numeric | Metric coordinate bounds |
| `plan_asset_path` | text | Versioned public/private asset reference |
| `is_active` | boolean | Publication control |
| timestamps | timestamptz | Audit |

### `hub.spaces`

A commercial or navigational area: work floor, meeting zone, office suite, event zone or
communal area.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Stable ID such as `L2-MEET` |
| `floor_id` | text FK | `hub.floors` |
| `parent_space_id` | text nullable FK | Optional hierarchy |
| `kind` | enum/text check | `desk_zone`, `meeting_room`, `private_office`, `event_space`, `communal` |
| `name`, `slug` | text | Display and URL identity |
| `capacity` | integer | Maximum approved occupancy |
| `amenities` | text[] or related table | Approved facilities |
| `description` | text | Hub copy, not generic property text |
| `is_public`, `is_active` | boolean | Publication controls |
| timestamps | timestamptz | Audit |

### `hub.bookable_units`

One sellable desk, room, office or event area. Visual geometry references `id`; commercial
data never lives in SVG colours or path identity.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | `L2-D001`, `L2-MR01`, `L2-OFFICE03` |
| `space_id` | text FK | Parent `hub.spaces` |
| `kind` | enum/text check | `hot_desk`, `dedicated_desk`, `meeting_room`, `private_office`, `event_space` |
| `label` | text | Human-findable name |
| `x_m`, `y_m` | numeric | Centre in the metric plan |
| `rotation_deg` | numeric | Overlay orientation |
| `capacity` | integer | Seats/people |
| `is_bookable`, `is_active` | boolean | Commercial and lifecycle state |
| `metadata` | jsonb | Versioned non-authoritative visual hints only |
| timestamps | timestamptz | Audit |

### `hub.media`

Media attaches to stable `space_id` or `bookable_unit_id`, allowing the plan, site, future
splat and concierge to resolve the same real place.

Key fields: `id`, optional `space_id`, optional `bookable_unit_id`, `kind`, `asset_path`,
`alt_text`, `poster_path`, `sort_order`, `is_public`, timestamps. A constraint requires
exactly one owning space/unit.

### `hub.products` and `hub.product_prices`

`hub.products` expresses the approved commercial concept; `hub.product_prices` maps a
bookable offer to immutable Stripe Price IDs.

Do not treat the browser's amount as authoritative. Proposed fields:

- Product: `id`, `kind`, `name`, `description`, `active`, entitlement rules.
- Price: `id`, `product_id`, `stripe_price_id`, `currency`, `billing_mode`, `interval`,
  `unit_amount_snapshot`, `active`, validity timestamps.

The amount snapshot is for audit/display comparison; Stripe remains authoritative for money.

### `hub.availability_rules` and `hub.closures`

- Recurring permitted booking windows, minimum/maximum duration and advance-booking rules.
- Explicit closure/maintenance blocks by space or unit.
- Rules generate or validate availability; they are not pre-expanded indefinitely.

### `hub.reservation_holds`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Server generated |
| `bookable_unit_id` | text FK | Stable inventory identity |
| `customer_id` | uuid nullable FK | Signed-in customer if known |
| `anonymous_session_hash` | text nullable | Opaque server-side ownership proof; never raw browser secret |
| `starts_at`, `ends_at` | timestamptz | Requested period |
| `booking_window` | `tstzrange` generated/stored | `[starts_at, ends_at)` |
| `status` | enum/text check | `active`, `converted`, `expired`, `released` |
| `expires_at` | timestamptz | Authoritative database expiry |
| `stripe_checkout_session_id` | text nullable unique | Payment attempt link |
| timestamps | timestamptz | Audit |

Only active, unexpired holds block inventory. Client timers are display aids, not authority.

### `hub.reservations`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Server generated |
| `bookable_unit_id` | text FK | Inventory identity |
| `customer_id` | uuid FK | Operational customer |
| `product_price_id` | uuid/text FK | Approved offer mapping |
| `booking_window` | `tstzrange` | Half-open `[start,end)` interval |
| `status` | enum/text check | `pending_payment`, `confirmed`, `cancelled`, `completed`, `refunded` |
| Stripe references | text | Checkout Session, PaymentIntent, Subscription/Invoice where applicable |
| amount/currency snapshot | integer/text | Immutable booking audit; never trusted from browser |
| timestamps | timestamptz | Audit |

Prevent overlapping blocking reservations for the same unit with a GiST exclusion constraint
over `bookable_unit_id WITH =` and `booking_window WITH &&`, scoped to blocking statuses.
The approved migration must confirm the required extension/default version without pinning an
extension version, following the current Supabase changelog.

### Customers, memberships, credits and add-ons

- `hub.customers`: `id`, optional `user_id`, Stripe Customer ID, approved contact fields,
  consent timestamps and operational status.
- `hub.memberships`: customer, product, Stripe Subscription ID, mirrored Stripe status,
  current period, cancellation state and last processed event.
- `hub.credit_ledgers`: append-only grants/uses/expiry rather than a mutable balance alone.
- `hub.add_ons`: stable add-on products; reservation relationship records quantity and
  immutable price snapshot.

### Events

`hub.events` may reference an event-space unit and contain publication/registration data.
Do not combine community event listings with inventory reservations until the rules are
confirmed.

### `private.stripe_events`

Append-only event processing ledger:

- Stripe event ID primary key.
- Event type and API version.
- Received, processing and processed timestamps.
- Processing result/error summary.
- Relevant object IDs.
- Hash or tightly controlled raw payload retention according to the privacy policy.

Webhook processing is idempotent: insert the event ID once, lock/process once, and make every
state transition safe to replay.

## Server-side operations

### `quote_availability`

Given a unit or filters plus `[starts_at, ends_at)`, return currently sellable units and
approved server-side price references. Public output contains availability, never occupant
identity.

### `acquire_hold`

One transaction:

1. Validate requested period, product and unit.
2. Expire obsolete holds for the relevant unit.
3. Check closures and blocking reservations.
4. Attempt an advisory or row-level lock for the unit/time operation.
5. Insert the hold only if no overlap exists.
6. Return the opaque hold reference and authoritative expiry.

The precise locking strategy must be proven with concurrent integration tests. Never implement
this as a browser read followed by a browser update.

### `release_hold`

Requires verified ownership or a privileged operator, changes state idempotently and never
deletes the audit record.

### `confirm_booking_from_stripe`

Private/server-only operation triggered by verified webhook processing. It locks the hold,
checks the Stripe object mapping, inserts or updates the reservation idempotently, marks the
hold converted and publishes an availability event.

## Public read model

Expose the smallest possible availability model, for example:

- Stable unit ID, display label, kind and capacity.
- Metric overlay position.
- Public media.
- `available`, `held`, `unavailable` or `your_booking` for the requested period.
- Approved display price reference/amount.

Never expose customer IDs, names, emails, hold owner tokens or payment identifiers.

## Realtime

- Prefer an authorised private Broadcast topic for availability changes.
- Do not create custom objects inside Supabase's locked `realtime` schema.
- Policies on `realtime.messages` may authorise channel access.
- Reconnect always re-fetches authoritative availability before applying later events.
- Realtime is notification, not the source of truth.

## RLS and grant test matrix

For every exposed object, create `supabase/tests/*.test.sql` and run `supabase test db`.

| Actor | Public inventory | Own customer/reservations | Other customers | Holds | Operator data |
| --- | --- | --- | --- | --- | --- |
| `anon` | Approved read model only | None | None | Server-mediated only | None |
| `authenticated` | Approved read model | Read own | None | Server-mediated/own result | None |
| operator role | Approved read | Scoped operational access | Scoped | Manage with audit | Scoped |
| server/service | Required operations | Required | Required | Required | Required |

Tests must assert both grants and row policies for SELECT, INSERT, UPDATE and DELETE. An UPDATE
policy must have the required SELECT policy. Views must be tested as carefully as tables.

## Approval questions

1. Are bookings anonymous until payment, or must customers authenticate first?
2. Which products require immediate payment, deposits, approval or enquiry only?
3. What is the authoritative hold duration for each product kind?
4. Can a room/office be sold in multiple durations, and what buffers apply between bookings?
5. Which membership entitlements grant credits, discounts or priority windows?
6. Which operator roles exist and what may each see/change?
7. What customer data may be retained, for how long, and for what consent basis?
8. Which availability state may be public before a date/time has been selected?

## Documentation used

- Supabase changelog: https://supabase.com/changelog
- Data API security: https://supabase.com/docs/guides/api/securing-your-api
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Database functions: https://supabase.com/docs/guides/database/functions
- Realtime authorisation: https://supabase.com/docs/guides/realtime/authorization
