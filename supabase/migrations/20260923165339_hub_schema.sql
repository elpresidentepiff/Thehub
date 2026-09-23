-- The Hub at Lloyds Wharf — operational schema.
--
-- Three schemas (docs/commerce/SUPABASE_SCHEMA_PROPOSAL.md):
--   hub      not exposed   inventory, catalogue, customers, reservations, memberships
--   private  not exposed   Stripe event ledger and server-only operations
--   api      exposed       the only schema the Data API serves (config.toml [api].schemas)
--
-- Stripe is authoritative for money. This database is authoritative for inventory,
-- reservation identity and operational state. No card data is stored anywhere.
--
-- Status: tested on a throwaway local Postgres (npm run db:test). NOT applied to any
-- Supabase project. Never apply to a VELO project.

create extension if not exists btree_gist with schema extensions;

create schema if not exists hub;
create schema if not exists private;
create schema if not exists api;

revoke all on schema hub, private, api from public;

-- ---------------------------------------------------------------------------------------
-- Inventory: identity and geometry. Mirrors data/inventory/*.json (seeded by the server).
-- ---------------------------------------------------------------------------------------

create table hub.floors (
  id              text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null,
  plan_revision   text not null,
  plan_asset_path text not null,
  width_m         numeric(7,3) not null check (width_m > 0),
  height_m        numeric(7,3) not null check (height_m > 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table hub.spaces (
  id          text primary key check (id ~ '^L[0-9]+-[A-Z0-9]+$'),
  floor_id    text not null references hub.floors (id),
  kind        text not null check (kind in ('desk_zone','meeting_zone','office_suite','communal','event_zone')),
  name        text not null,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index spaces_floor_idx on hub.spaces (floor_id);

-- One sellable thing. An id is issued once and never reused (retire, don't delete).
create table hub.bookable_units (
  id           text primary key check (id ~ '^L[0-9]+-(D[0-9]{3}|MR[0-9]{2}|OFFICE[0-9]{2}|EVENT[0-9]{2})$'),
  floor_id     text not null references hub.floors (id),
  space_id     text not null references hub.spaces (id),
  kind         text not null check (kind in ('desk','meeting_room','private_office','event_space')),
  label        text not null,
  capacity     integer not null check (capacity > 0),
  x_m          numeric(7,3) not null,
  y_m          numeric(7,3) not null,
  rot_deg      numeric(6,2) not null default 0,
  footprint    jsonb not null check (jsonb_typeof(footprint) = 'array'),
  is_bookable  boolean not null default true,
  is_public    boolean not null default true,
  verified     boolean not null default false,   -- true once walked on site
  retired_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint unit_kind_matches_id check (
       (kind = 'desk'           and id ~ '-D[0-9]{3}$')
    or (kind = 'meeting_room'   and id ~ '-MR[0-9]{2}$')
    or (kind = 'private_office' and id ~ '-OFFICE[0-9]{2}$')
    or (kind = 'event_space'    and id ~ '-EVENT[0-9]{2}$'))
);
create index bookable_units_floor_idx on hub.bookable_units (floor_id);
create index bookable_units_space_idx on hub.bookable_units (space_id);

-- Real media attached to a stable id, so the plan, the site, a future splat and a
-- concierge all resolve the same place.
create table hub.media (
  id          uuid primary key default gen_random_uuid(),
  space_id    text references hub.spaces (id),
  unit_id     text references hub.bookable_units (id),
  kind        text not null check (kind in ('photo','video','splat')),
  asset_path  text not null,
  poster_path text,
  alt_text    text not null check (length(alt_text) > 0),
  sort_order  integer not null default 0,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint media_single_owner check (num_nonnulls(space_id, unit_id) = 1)
);
create index media_space_idx on hub.media (space_id);
create index media_unit_idx on hub.media (unit_id);

-- Closures and maintenance blocks. A closure on a space closes every unit in it.
create table hub.closures (
  id         uuid primary key default gen_random_uuid(),
  space_id   text references hub.spaces (id),
  unit_id    text references hub.bookable_units (id),
  during     tstzrange not null check (not isempty(during) and lower(during) is not null and upper(during) is not null),
  reason     text not null,
  created_at timestamptz not null default now(),
  constraint closure_single_target check (num_nonnulls(space_id, unit_id) = 1)
);
create index closures_unit_during_idx on hub.closures using gist (unit_id extensions.gist_text_ops, during);
create index closures_space_during_idx on hub.closures using gist (space_id extensions.gist_text_ops, during);

-- ---------------------------------------------------------------------------------------
-- Catalogue: what is sold and the approved Stripe Price for each environment.
-- The browser never supplies an amount or a Stripe Price id.
-- ---------------------------------------------------------------------------------------

create table hub.products (
  id              text primary key check (id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  kind            text not null check (kind in ('day_pass','hot_desk','dedicated_desk','meeting_room_hire',
                                                'private_office','event_hire','membership','credit_pack','add_on')),
  name            text not null,
  unit_kind       text check (unit_kind in ('desk','meeting_room','private_office','event_space')),
  billing         text not null check (billing in ('one_time','recurring','enquiry')),
  period_unit     text check (period_unit in ('hour','day','month')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table hub.product_prices (
  id                 uuid primary key default gen_random_uuid(),
  product_id         text not null references hub.products (id),
  environment        text not null check (environment in ('development','preview','production')),
  stripe_price_id    text check (stripe_price_id ~ '^price_'),
  currency           text not null default 'gbp' check (currency ~ '^[a-z]{3}$'),
  unit_amount        integer not null check (unit_amount >= 0),  -- minor units; audit snapshot, Stripe is authoritative
  recurring_interval text check (recurring_interval in ('month','year')),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);
create index product_prices_product_idx on hub.product_prices (product_id);
create unique index product_prices_one_active
  on hub.product_prices (product_id, environment) where is_active;

-- ---------------------------------------------------------------------------------------
-- Customers, memberships, credits.
-- ---------------------------------------------------------------------------------------

create table hub.customers (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid unique references auth.users (id) on delete set null,
  stripe_customer_id   text unique check (stripe_customer_id ~ '^cus_'),
  email                text not null check (position('@' in email) > 1),
  full_name            text,
  marketing_consent_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index customers_email_idx on hub.customers (lower(email));

create table hub.memberships (
  id                     uuid primary key default gen_random_uuid(),
  customer_id            uuid not null references hub.customers (id),
  product_id             text not null references hub.products (id),
  stripe_subscription_id text unique check (stripe_subscription_id ~ '^sub_'),
  -- mirrors Stripe's subscription status; the commercial meaning of each is decided in code
  status                 text not null check (status in ('incomplete','incomplete_expired','trialing','active',
                                                         'past_due','canceled','unpaid','paused')),
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  last_stripe_event_at   timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index memberships_customer_idx on hub.memberships (customer_id);
create index memberships_product_idx on hub.memberships (product_id);

-- ---------------------------------------------------------------------------------------
-- Reservations. A hold is a reservation in state 'held'. One table, one exclusion
-- constraint: no two blocking rows for the same unit may overlap in time, whatever code
-- path wrote them. (The proposal had holds in a separate table; that needs a lock
-- discipline across two tables to stay correct. This needs none.)
--
--   held ──► confirmed ──► completed
--     │          └──────► cancelled / refunded
--     ├──► expired     (hold lapsed, or Checkout expired)
--     └──► released    (visitor let it go)
-- ---------------------------------------------------------------------------------------

create table hub.reservations (
  id                          uuid primary key default gen_random_uuid(),
  unit_id                     text not null references hub.bookable_units (id),
  product_price_id            uuid not null references hub.product_prices (id),
  customer_id                 uuid references hub.customers (id),
  -- sha-256 (hex) of an opaque server-issued token, for anonymous holds. Never the raw token.
  owner_token_hash            text check (owner_token_hash ~ '^[0-9a-f]{64}$'),
  membership_id               uuid references hub.memberships (id),
  during                      tstzrange not null,
  status                      text not null default 'held'
                              check (status in ('held','confirmed','completed','cancelled','refunded','expired','released')),
  hold_expires_at             timestamptz,
  amount_total                integer check (amount_total >= 0),     -- minor units, from Stripe, never the browser
  currency                    text check (currency ~ '^[a-z]{3}$'),
  stripe_checkout_session_id  text unique check (stripe_checkout_session_id ~ '^cs_'),
  stripe_payment_intent_id    text check (stripe_payment_intent_id ~ '^pi_'),
  needs_refund                boolean not null default false,        -- paid after losing the slot
  status_changed_at           timestamptz not null default now(),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint during_is_half_open check (
    not isempty(during) and lower(during) is not null and lower_inc(during) and not upper_inc(during)),
  -- open-ended only for a dedicated-desk membership allocation
  constraint during_bounded_unless_membership check (upper(during) is not null or membership_id is not null),
  constraint held_has_expiry check (status <> 'held' or hold_expires_at is not null),
  constraint has_owner check (customer_id is not null or owner_token_hash is not null),
  constraint confirmed_has_customer check (status not in ('confirmed','completed') or customer_id is not null),

  constraint no_double_booking exclude using gist (
    unit_id extensions.gist_text_ops with =,
    during with &&
  ) where (status in ('held','confirmed'))
);
create index reservations_customer_idx on hub.reservations (customer_id);
create index reservations_product_price_idx on hub.reservations (product_price_id);
create index reservations_membership_idx on hub.reservations (membership_id);
create index reservations_held_expiry_idx on hub.reservations (hold_expires_at) where status = 'held';
create index reservations_during_idx on hub.reservations using gist (during);

create table hub.reservation_add_ons (
  reservation_id  uuid not null references hub.reservations (id) on delete cascade,
  product_id      text not null references hub.products (id),
  quantity        integer not null check (quantity > 0),
  unit_amount     integer not null check (unit_amount >= 0),  -- snapshot at booking
  primary key (reservation_id, product_id)
);
create index reservation_add_ons_product_idx on hub.reservation_add_ons (product_id);

-- Append-only: a balance is the sum. Rows are never updated or deleted (enforced by the
-- trigger below and by grants in the access-control migration).
create table hub.credit_ledger (
  id              bigint generated always as identity primary key,
  customer_id     uuid not null references hub.customers (id),
  delta           integer not null check (delta <> 0),
  reason          text not null check (reason in ('grant','purchase','use','refund','expiry','adjustment')),
  reservation_id  uuid references hub.reservations (id),
  membership_id   uuid references hub.memberships (id),
  stripe_event_id text,
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index credit_ledger_customer_idx on hub.credit_ledger (customer_id);
create index credit_ledger_reservation_idx on hub.credit_ledger (reservation_id);
create index credit_ledger_membership_idx on hub.credit_ledger (membership_id);

-- ---------------------------------------------------------------------------------------
-- Stripe event ledger: every webhook is recorded once, before it is acted on.
-- ---------------------------------------------------------------------------------------

create table private.stripe_events (
  id             text primary key check (id ~ '^evt_'),
  type           text not null,
  livemode       boolean not null,
  object_id      text,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  status         text not null default 'received' check (status in ('received','processed','ignored','failed')),
  outcome        text,
  error          text,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz
);

-- ---------------------------------------------------------------------------------------
-- Bookkeeping triggers
-- ---------------------------------------------------------------------------------------

create function private.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.touch_reservation() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

create function private.forbid_change() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end;
$$;

create trigger floors_touch         before update on hub.floors         for each row execute function private.touch_updated_at();
create trigger spaces_touch         before update on hub.spaces         for each row execute function private.touch_updated_at();
create trigger bookable_units_touch before update on hub.bookable_units for each row execute function private.touch_updated_at();
create trigger products_touch       before update on hub.products       for each row execute function private.touch_updated_at();
create trigger customers_touch      before update on hub.customers      for each row execute function private.touch_updated_at();
create trigger memberships_touch    before update on hub.memberships    for each row execute function private.touch_updated_at();
create trigger reservations_touch   before update on hub.reservations   for each row execute function private.touch_reservation();
create trigger credit_ledger_append_only before update or delete on hub.credit_ledger
  for each row execute function private.forbid_change();
