-- Booking behaviour: holds, release, Checkout, webhooks, availability, closures.
-- Runs the operations as service_role, exactly as the Next.js server will.
begin;
select plan(35);

-- Fixtures (as the migration owner). Floor L9 is test-only; everything rolls back.
insert into hub.floors (id, name, plan_revision, plan_asset_path, width_m, height_m)
values ('test-floor', 'Test floor', 'rev-t', 'test.svg', 10, 10);
insert into hub.spaces (id, floor_id, kind, name) values ('L9-MAIN', 'test-floor', 'desk_zone', 'Test zone');
insert into hub.bookable_units (id, floor_id, space_id, kind, label, capacity, x_m, y_m, footprint, is_bookable) values
  ('L9-D001', 'test-floor', 'L9-MAIN', 'desk', 'Desk 1', 1, 1, 1, '[]', true),
  ('L9-D002', 'test-floor', 'L9-MAIN', 'desk', 'Desk 2', 1, 2, 1, '[]', true),
  ('L9-D003', 'test-floor', 'L9-MAIN', 'desk', 'Desk 3', 1, 3, 1, '[]', false),
  ('L9-MR01', 'test-floor', 'L9-MAIN', 'meeting_room', 'Room', 4, 5, 5, '[]', true);
insert into hub.products (id, kind, name, unit_kind, billing, period_unit) values
  ('test_day_pass', 'day_pass', 'Test day pass', 'desk', 'one_time', 'day'),
  ('test_room_hour', 'meeting_room_hire', 'Test room hire', 'meeting_room', 'one_time', 'hour');
insert into hub.product_prices (id, product_id, environment, unit_amount) values
  ('00000000-0000-4000-8000-0000000000d1', 'test_day_pass', 'development', 3500),
  ('00000000-0000-4000-8000-0000000000e1', 'test_room_hour', 'development', 5500);
insert into hub.customers (id, email) values
  ('00000000-0000-4000-8000-00000000c001', 'a@example.test'),
  ('00000000-0000-4000-8000-00000000c002', 'b@example.test');

-- Tomorrow at 10:00, 11:00 ... as a lookup, so the tests read like a diary.
create temp table tt (k text primary key, v timestamptz);
insert into tt select 't' || h, date_trunc('day', now()) + interval '1 day' + make_interval(hours => h)
from generate_series(9, 16) h;
create function pg_temp.at(k text) returns timestamptz language sql stable as $$ select v from tt where tt.k = $1 $$;
grant select on tt to service_role;

-- Owner token hashes (sha-256 hex of a server-issued token).
create temp table who (k text primary key, h text);
insert into who values ('a', repeat('a', 64)), ('b', repeat('b', 64)), ('c', repeat('c', 64));
create function pg_temp.tok(k text) returns text language sql stable as $$ select h from who where who.k = $1 $$;
grant select on who to service_role;

set local role service_role;

-- ---- holds ------------------------------------------------------------------------------
select isnt(
  (private.acquire_hold('L9-D001', '00000000-0000-4000-8000-0000000000d1', pg_temp.at('t10'), pg_temp.at('t12'), 10, null, pg_temp.tok('a'))).id,
  null, 'a visitor can hold a free desk');

select throws_ok(
  $$select private.acquire_hold('L9-D001', '00000000-0000-4000-8000-0000000000d1', pg_temp.at('t11'), pg_temp.at('t13'), 10, null, pg_temp.tok('b'))$$,
  'HB409', null, 'an overlapping hold on the same desk is refused');

select throws_ok(
  $$select private.acquire_hold('L9-D001', '00000000-0000-4000-8000-0000000000d1', pg_temp.at('t10'), pg_temp.at('t12'), 10, '00000000-0000-4000-8000-00000000c002', null)$$,
  'HB409', null, 'the identical period is refused to a signed-in customer too');

select lives_ok(
  $$select private.acquire_hold('L9-D001', '00000000-0000-4000-8000-0000000000d1', pg_temp.at('t12'), pg_temp.at('t14'), 10, null, pg_temp.tok('b'))$$,
  'back-to-back periods do not collide: [10,12) then [12,14)');

select lives_ok(
  $$select private.acquire_hold('L9-D002', '00000000-0000-4000-8000-0000000000d1', pg_temp.at('t10'), pg_temp.at('t12'), 10, null, pg_temp.tok('b'))$$,
  'a different desk at the same time is fine');

select throws_ok(
  $$select private.acquire_hold('L9-D003', '00000000-0000-4000-8000-0000000000d1', pg_temp.at('t10'), pg_temp.at('t12'), 10, null, pg_temp.tok('a'))$$,
  'HB404', null, 'a unit marked not bookable cannot be held');

select throws_ok(
  $$select private.acquire_hold('L9-D002', '00000000-0000-4000-8000-0000000000e1', pg_temp.at('t12'), pg_temp.at('t13'), 10, null, pg_temp.tok('a'))$$,
  'HB400', null, 'a meeting-room price cannot book a desk');

select throws_ok(
  $$select private.acquire_hold('L9-D002', '00000000-0000-4000-8000-0000000000d1', pg_temp.at('t13'), pg_temp.at('t12'), 10, null, pg_temp.tok('a'))$$,
  'HB400', null, 'a period that ends before it starts is refused');

select throws_ok(
  $$select private.acquire_hold('L9-D002', '00000000-0000-4000-8000-0000000000d1', now() - interval '3 hours', now() - interval '2 hours', 10, null, pg_temp.tok('a'))$$,
  'HB400', null, 'a period in the past is refused');

select throws_ok(
  $$select private.acquire_hold('L9-D002', '00000000-0000-4000-8000-0000000000d1', pg_temp.at('t14'), pg_temp.at('t15'), 10, null, null)$$,
  'HB400', null, 'a hold needs an owner');

select throws_ok(
  $$select private.acquire_hold('L9-D002', '00000000-0000-4000-8000-0000000000d1', pg_temp.at('t14'), pg_temp.at('t15'), 0, null, pg_temp.tok('a'))$$,
  'HB400', null, 'hold length is bounded');

-- ---- lapsed holds -----------------------------------------------------------------------
update hub.reservations set hold_expires_at = now() - interval '1 second'
where unit_id = 'L9-D001' and owner_token_hash = pg_temp.tok('a') and status = 'held';

select lives_ok(
  $$select private.acquire_hold('L9-D001', '00000000-0000-4000-8000-0000000000d1', pg_temp.at('t10'), pg_temp.at('t12'), 10, null, pg_temp.tok('c'))$$,
  'a lapsed hold stops blocking the moment someone asks');

select is(
  (select status from hub.reservations where unit_id = 'L9-D001' and owner_token_hash = pg_temp.tok('a')),
  'expired', 'and the lapsed hold is marked expired, not deleted');

-- ---- release ----------------------------------------------------------------------------
select throws_ok(
  $$select private.release_hold((select id from hub.reservations where owner_token_hash = pg_temp.tok('c')), pg_temp.tok('a'), null)$$,
  'HB403', null, 'only the owner can release a hold');

select ok(
  private.release_hold((select id from hub.reservations where owner_token_hash = pg_temp.tok('c')), pg_temp.tok('c'), null),
  'the owner can release their hold');

select ok(
  not private.release_hold((select id from hub.reservations where owner_token_hash = pg_temp.tok('c')), pg_temp.tok('c'), null),
  'releasing twice is a harmless no-op');

select lives_ok(
  $$select private.acquire_hold('L9-D001', '00000000-0000-4000-8000-0000000000d1', pg_temp.at('t10'), pg_temp.at('t12'), 10, null, pg_temp.tok('a'))$$,
  'a released slot is free again');

-- ---- Checkout ---------------------------------------------------------------------------
select ok(
  (private.attach_checkout_session(
     (select id from hub.reservations where owner_token_hash = pg_temp.tok('a') and status = 'held' and unit_id = 'L9-D001'),
     'cs_test_1', now() + interval '30 minutes')).hold_expires_at >= now() + interval '30 minutes',
  'attaching a Checkout Session stretches the hold past the session''s expiry');

select throws_ok(
  $$select private.attach_checkout_session((select id from hub.reservations where owner_token_hash = pg_temp.tok('c')), 'cs_test_x', now() + interval '30 minutes')$$,
  'HB410', null, 'a released hold cannot start Checkout');

select is(
  private.confirm_from_checkout('cs_test_1', '00000000-0000-4000-8000-00000000c001', 'pi_test_1', 3500, 'gbp'),
  'confirmed', 'a completed Checkout confirms the booking');

select is(
  private.confirm_from_checkout('cs_test_1', '00000000-0000-4000-8000-00000000c001', 'pi_test_1', 3500, 'gbp'),
  'already_confirmed', 'a replayed webhook changes nothing');

select is(
  (select row(status, customer_id, amount_total, hold_expires_at)::text from hub.reservations where stripe_checkout_session_id = 'cs_test_1'),
  row('confirmed', '00000000-0000-4000-8000-00000000c001'::uuid, 3500, null::timestamptz)::text,
  'the confirmed booking records customer and amount, and no longer expires');

select is(
  private.confirm_from_checkout('cs_nobody', '00000000-0000-4000-8000-00000000c001', 'pi_x', 1, 'gbp'),
  'unknown_session', 'a session we never issued is reported, not booked');

-- Paid after the hold lapsed, slot still free: honour it.
select private.attach_checkout_session(
  (select id from hub.reservations where unit_id = 'L9-D002' and status = 'held'), 'cs_test_2', now() + interval '30 minutes');
update hub.reservations set status = 'expired' where stripe_checkout_session_id = 'cs_test_2';
select is(
  private.confirm_from_checkout('cs_test_2', '00000000-0000-4000-8000-00000000c002', 'pi_test_2', 3500, 'gbp'),
  'confirmed_after_expiry', 'paid after the hold lapsed, slot still free: the booking stands');

-- Paid after the hold lapsed, slot taken by someone else: flag for refund, never double-book.
select private.attach_checkout_session(
  (private.acquire_hold('L9-MR01', '00000000-0000-4000-8000-0000000000e1', pg_temp.at('t10'), pg_temp.at('t11'), 10, null, pg_temp.tok('a'))).id,
  'cs_test_3', now() + interval '30 minutes');
update hub.reservations set status = 'expired' where stripe_checkout_session_id = 'cs_test_3';
select lives_ok(
  $$select private.acquire_hold('L9-MR01', '00000000-0000-4000-8000-0000000000e1', pg_temp.at('t10'), pg_temp.at('t12'), 10, null, pg_temp.tok('b'))$$,
  'someone else takes the room once the first hold lapsed');
select is(
  private.confirm_from_checkout('cs_test_3', '00000000-0000-4000-8000-00000000c001', 'pi_test_3', 5500, 'gbp'),
  'conflict_refund_required', 'the late payer is flagged for a refund instead of double-booking');
select is(
  (select row(status, needs_refund)::text from hub.reservations where stripe_checkout_session_id = 'cs_test_3'),
  row('expired', true)::text, 'the late payment stays expired with needs_refund set');

select is(private.expire_checkout('cs_nobody'), 'noop', 'expiring an unknown session is a no-op');

-- ---- availability read model ------------------------------------------------------------
select is(
  (select jsonb_object_agg(unit_id, state) from private.unit_availability('test-floor', pg_temp.at('t10'), pg_temp.at('t12'))),
  '{"L9-D001": "unavailable", "L9-D002": "unavailable", "L9-D003": "not_bookable", "L9-MR01": "held"}'::jsonb,
  'availability: confirmed = unavailable, live hold = held, flagged unit = not_bookable');

select is(
  (select state from private.unit_availability('test-floor', pg_temp.at('t10'), pg_temp.at('t12'), '00000000-0000-4000-8000-00000000c001') where unit_id = 'L9-D001'),
  'yours', 'a customer sees their own booking as yours');

select is(
  (select state from private.unit_availability('test-floor', pg_temp.at('t14'), pg_temp.at('t16')) where unit_id = 'L9-D002'),
  'available', 'the same desk is available later that day');

-- ---- closures ---------------------------------------------------------------------------
insert into hub.closures (unit_id, during, reason)
values ('L9-MR01', tstzrange(pg_temp.at('t13'), pg_temp.at('t15'), '[)'), 'Maintenance');
select throws_ok(
  $$select private.acquire_hold('L9-MR01', '00000000-0000-4000-8000-0000000000e1', pg_temp.at('t14'), pg_temp.at('t15'), 10, null, pg_temp.tok('a'))$$,
  'HB423', null, 'a closed room cannot be held');

-- ---- webhook ledger ---------------------------------------------------------------------
select ok(private.record_stripe_event('evt_test_1', 'checkout.session.completed', false, 'cs_test_1', repeat('0', 64)),
  'a new Stripe event is processed');
select private.finish_stripe_event('evt_test_1', 'processed', 'confirmed');
select ok(not private.record_stripe_event('evt_test_1', 'checkout.session.completed', false, 'cs_test_1', repeat('0', 64)),
  'a duplicate delivery of a processed event is skipped');

-- ---- the database, not the code, forbids double booking ---------------------------------
select throws_ok(
  $$insert into hub.reservations (unit_id, product_price_id, customer_id, during, status)
    values ('L9-D001', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000c002',
            tstzrange(pg_temp.at('t11'), pg_temp.at('t12'), '[)'), 'confirmed')$$,
  '23P01', null, 'even a raw insert that skips every function cannot double-book');

select * from finish();
rollback;
