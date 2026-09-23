-- Who can see and do what: anon, a signed-in customer, another customer, an operator,
-- and someone who tries to promote themselves through user_metadata.
begin;
select plan(21);

insert into hub.floors (id, name, plan_revision, plan_asset_path, width_m, height_m)
values ('test-floor', 'Test floor', 'rev-t', 'test.svg', 10, 10);
insert into hub.spaces (id, floor_id, kind, name) values ('L9-MAIN', 'test-floor', 'desk_zone', 'Test zone');
insert into hub.bookable_units (id, floor_id, space_id, kind, label, capacity, x_m, y_m, footprint, is_public, retired_at) values
  ('L9-D001', 'test-floor', 'L9-MAIN', 'desk', 'Public desk', 1, 1, 1, '[]', true, null),
  ('L9-D002', 'test-floor', 'L9-MAIN', 'desk', 'Hidden desk', 1, 2, 1, '[]', false, null),
  ('L9-D003', 'test-floor', 'L9-MAIN', 'desk', 'Retired desk', 1, 3, 1, '[]', true, now());
insert into hub.media (unit_id, kind, asset_path, alt_text) values ('L9-D001', 'photo', 'd1.jpg', 'Desk by the window');
insert into hub.products (id, kind, name, unit_kind, billing) values ('test_day_pass', 'day_pass', 'Test', 'desk', 'one_time');
insert into hub.product_prices (id, product_id, environment, unit_amount)
values ('00000000-0000-4000-8000-0000000000d1', 'test_day_pass', 'development', 3500);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'a@example.test'),
  ('00000000-0000-4000-8000-0000000000b1', 'b@example.test'),
  ('00000000-0000-4000-8000-0000000000f1', 'operator@example.test');
insert into hub.customers (id, user_id, email) values
  ('00000000-0000-4000-8000-00000000c00a', '00000000-0000-4000-8000-0000000000a1', 'a@example.test'),
  ('00000000-0000-4000-8000-00000000c00b', '00000000-0000-4000-8000-0000000000b1', 'b@example.test');
insert into hub.reservations (unit_id, product_price_id, customer_id, during, status) values
  ('L9-D001', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000c00a',
   tstzrange(now() + interval '1 day', now() + interval '1 day 2 hours', '[)'), 'confirmed'),
  ('L9-D001', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000c00b',
   tstzrange(now() + interval '2 days', now() + interval '2 days 2 hours', '[)'), 'confirmed');

-- ---- anon -------------------------------------------------------------------------------
set local role anon;
select is((select count(*)::int from api.units where floor_id = 'test-floor'), 1, 'anon sees public, unretired units only');
select is((select count(*)::int from api.unit_media where unit_id like 'L9-%'), 1, 'anon sees public media');
select is((select count(*)::int from api.floors where id = 'test-floor'), 1, 'anon sees the active floor');
select throws_ok('select * from api.my_reservations', '42501', null, 'anon has no reservations view');
select throws_ok('select * from hub.reservations', '42501', null, 'anon cannot read reservations');
select throws_ok('select email from hub.customers', '42501', null, 'anon cannot read customers');
select throws_ok('select * from hub.product_prices', '42501', null, 'anon cannot read the price table');
select throws_ok('select * from private.stripe_events', '42501', null, 'anon cannot read the Stripe ledger');
select throws_ok(
  $$select private.acquire_hold('L9-D001', '00000000-0000-4000-8000-0000000000d1', now() + interval '3 days', now() + interval '3 days 1 hour', 10, null, repeat('a', 64))$$,
  '42501', null, 'anon cannot call booking operations');
select throws_ok(
  $$insert into hub.reservations (unit_id, product_price_id, owner_token_hash, during, hold_expires_at)
    values ('L9-D001', '00000000-0000-4000-8000-0000000000d1', repeat('a', 64), tstzrange(now() + interval '4 days', now() + interval '4 days 1 hour'), now() + interval '10 minutes')$$,
  '42501', null, 'anon cannot write reservations directly');
reset role;

-- ---- customer A -------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}';
select is((select count(*)::int from api.my_reservations), 1, 'a customer sees their own booking');
select is((select count(*)::int from hub.reservations), 1, 'and RLS hides everyone else''s, even queried directly');
select is((select count(*)::int from hub.customers), 1, 'a customer sees only their own customer record');
select throws_ok(
  $$update hub.reservations set status = 'cancelled'$$,
  '42501', null, 'a customer cannot change a booking directly');
select throws_ok(
  $$select private.release_hold(gen_random_uuid(), repeat('a', 64), null)$$,
  '42501', null, 'a customer cannot call booking operations directly');
reset role;

-- ---- customer B -------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}';
select is(
  (select customer_id from hub.reservations),
  '00000000-0000-4000-8000-00000000c00b'::uuid, 'customer B sees only B''s booking');
reset role;

-- ---- operator (app_metadata, set by the server) -----------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000f1", "role": "authenticated", "app_metadata": {"hub_role": "operator"}}';
select is((select count(*)::int from hub.reservations), 2, 'an operator sees every booking');
select is((select count(*)::int from api.my_reservations), 0, 'but "my reservations" still means mine');
select throws_ok($$delete from hub.reservations$$, '42501', null, 'an operator cannot delete bookings through the API');
reset role;

-- ---- self-promotion via user_metadata ---------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated", "user_metadata": {"hub_role": "operator"}}';
select is((select count(*)::int from hub.reservations), 1, 'user_metadata cannot grant operator access');
reset role;

-- ---- service role -----------------------------------------------------------------------
set local role service_role;
select is((select count(*)::int from hub.reservations), 2, 'the server sees everything');
reset role;

select * from finish();
rollback;
