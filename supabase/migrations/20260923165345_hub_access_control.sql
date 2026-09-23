-- The Hub — access control.
--
-- Access model:
--   anon           reads the public catalogue through `api` views: floors, units, media.
--   authenticated  the same, plus their own reservations (api.my_reservations).
--   operator       an authenticated user whose app_metadata.hub_role = 'operator'
--                  (app_metadata is server-controlled; user_metadata is never trusted).
--                  Reads reservations, customers and memberships.
--   service_role   the Next.js server. Runs every booking operation in `private`.
--
-- Holds, availability and payments never go through the Data API. The browser calls the
-- Next.js server, which validates and calls private.* with the service role.
--
-- New tables are not exposed to the Data API automatically (Supabase, 2026): every grant
-- below is deliberate. RLS is on for every table, exposed or not.

-- ---------------------------------------------------------------------------------------
-- Schema usage
-- ---------------------------------------------------------------------------------------
grant usage on schema api to anon, authenticated, service_role;
-- hub is not exposed; anon/authenticated need usage only so security_invoker views can
-- read the underlying rows under RLS.
grant usage on schema hub to anon, authenticated, service_role;
grant usage on schema private to service_role;

-- Functions are executable by PUBLIC unless revoked. Nothing here is.
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on all functions in schema hub from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema hub revoke execute on functions from public;
alter default privileges in schema api revoke execute on functions from public;

-- ---------------------------------------------------------------------------------------
-- Operator check. In hub (unexposed) so it cannot be called as an RPC.
-- ---------------------------------------------------------------------------------------
create function hub.is_operator() returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'hub_role', '') = 'operator';
$$;
revoke execute on function hub.is_operator() from public;
grant execute on function hub.is_operator() to authenticated;

-- ---------------------------------------------------------------------------------------
-- Row level security: on for everything.
-- ---------------------------------------------------------------------------------------
alter table hub.floors               enable row level security;
alter table hub.spaces               enable row level security;
alter table hub.bookable_units       enable row level security;
alter table hub.media                enable row level security;
alter table hub.closures             enable row level security;
alter table hub.products             enable row level security;
alter table hub.product_prices       enable row level security;
alter table hub.customers            enable row level security;
alter table hub.memberships          enable row level security;
alter table hub.reservations         enable row level security;
alter table hub.reservation_add_ons  enable row level security;
alter table hub.credit_ledger        enable row level security;
alter table private.stripe_events    enable row level security;

-- Public catalogue ------------------------------------------------------------------------
grant select (id, name, plan_revision, plan_asset_path, width_m, height_m, is_active)
  on hub.floors to anon, authenticated;
create policy floors_public_read on hub.floors
  for select to anon, authenticated using (is_active);

grant select (id, floor_id, kind, name, is_public)
  on hub.spaces to anon, authenticated;
create policy spaces_public_read on hub.spaces
  for select to anon, authenticated using (is_public);

grant select (id, floor_id, space_id, kind, label, capacity, x_m, y_m, rot_deg, footprint,
              is_bookable, is_public, retired_at)
  on hub.bookable_units to anon, authenticated;
create policy units_public_read on hub.bookable_units
  for select to anon, authenticated using (is_public and retired_at is null);

grant select (id, space_id, unit_id, kind, asset_path, poster_path, alt_text, sort_order, is_public)
  on hub.media to anon, authenticated;
create policy media_public_read on hub.media
  for select to anon, authenticated using (is_public);

-- Own records ------------------------------------------------------------------------------
grant select (id, user_id, email, full_name) on hub.customers to authenticated;
create policy customers_read_own on hub.customers
  for select to authenticated using (user_id = (select auth.uid()));
create policy customers_operator_read on hub.customers
  for select to authenticated using ((select hub.is_operator()));

grant select (id, unit_id, customer_id, during, status, amount_total, currency, created_at)
  on hub.reservations to authenticated;
create policy reservations_read_own on hub.reservations
  for select to authenticated
  using (customer_id in (select c.id from hub.customers c where c.user_id = (select auth.uid())));
create policy reservations_operator_read on hub.reservations
  for select to authenticated using ((select hub.is_operator()));

grant select (id, customer_id, product_id, status, current_period_start, current_period_end,
              cancel_at_period_end)
  on hub.memberships to authenticated;
create policy memberships_read_own on hub.memberships
  for select to authenticated
  using (customer_id in (select c.id from hub.customers c where c.user_id = (select auth.uid())));
create policy memberships_operator_read on hub.memberships
  for select to authenticated using ((select hub.is_operator()));

-- No client policies at all on: closures, products, product_prices, reservation_add_ons,
-- credit_ledger, private.stripe_events. With RLS on and no policy, clients see nothing.

-- ---------------------------------------------------------------------------------------
-- The server (service_role bypasses RLS on Supabase; grants still apply).
-- ---------------------------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema hub to service_role;
revoke update, delete on hub.credit_ledger from service_role;   -- append-only
grant select, insert, update on private.stripe_events to service_role;
grant usage on all sequences in schema hub to service_role;

grant execute on function
  private.upsert_inventory(jsonb),
  private.acquire_hold(text, uuid, timestamptz, timestamptz, integer, uuid, text),
  private.release_hold(uuid, text, uuid),
  private.attach_checkout_session(uuid, text, timestamptz),
  private.record_stripe_event(text, text, boolean, text, text),
  private.finish_stripe_event(text, text, text, text),
  private.confirm_from_checkout(text, uuid, text, integer, text),
  private.expire_checkout(text),
  private.sweep_expired_holds(),
  private.unit_availability(text, timestamptz, timestamptz, uuid),
  private.ensure_customer(text, text, text, uuid)
to service_role;

-- ---------------------------------------------------------------------------------------
-- The exposed surface: four security_invoker views. RLS on the base tables applies.
-- ---------------------------------------------------------------------------------------
create view api.floors with (security_invoker = true) as
  select id, name, plan_revision, plan_asset_path, width_m, height_m
  from hub.floors;

create view api.units with (security_invoker = true) as
  select id, floor_id, space_id, kind, label, capacity, x_m, y_m, rot_deg, footprint, is_bookable
  from hub.bookable_units;

create view api.unit_media with (security_invoker = true) as
  select id, space_id, unit_id, kind, asset_path, poster_path, alt_text, sort_order
  from hub.media;

-- "my" means mine, even for an operator (whose policy would otherwise show everyone's).
create view api.my_reservations with (security_invoker = true) as
  select r.id, r.unit_id, lower(r.during) as starts_at, upper(r.during) as ends_at, r.status,
         r.amount_total, r.currency, r.created_at
  from hub.reservations r
  join hub.customers c on c.id = r.customer_id
  where c.user_id = (select auth.uid());

revoke all on api.floors, api.units, api.unit_media, api.my_reservations from public, anon, authenticated;
grant select on api.floors, api.units, api.unit_media to anon, authenticated;
grant select on api.my_reservations to authenticated;
grant select on api.floors, api.units, api.unit_media, api.my_reservations to service_role;
