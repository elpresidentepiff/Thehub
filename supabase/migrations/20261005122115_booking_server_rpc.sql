-- Server booking RPC boundary.
--
-- `api` is the only Data API schema. These narrowly shaped functions are therefore the
-- bridge from the Next.js server to the unexposed private operations. Every wrapper is
-- SECURITY INVOKER and executable only by service_role; anon/authenticated still cannot
-- discover booking ownership or write reservations.

-- Serialize contenders for the same unit before they touch the GiST exclusion constraint.
-- The constraint remains the final invariant; the advisory lock prevents PostgreSQL from
-- deadlocking when many identical inserts concurrently inspect one another's uncommitted
-- GiST tuples.

create table private.booking_rate_limits (
  bucket_kind       text not null check (bucket_kind in ('actor', 'network')),
  bucket_hash       text not null check (bucket_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempts          integer not null check (attempts > 0),
  updated_at        timestamptz not null default now(),
  primary key (bucket_kind, bucket_hash)
);
create index booking_rate_limits_updated_idx on private.booking_rate_limits (updated_at);
alter table private.booking_rate_limits enable row level security;

create function private.consume_booking_rate_limit(
  p_actor_bucket   text,
  p_network_bucket text,
  p_now            timestamptz default now(),
  p_window_seconds integer default 60,
  p_actor_limit    integer default 8,
  p_network_limit  integer default 30
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_attempts integer;
  v_network_attempts integer;
begin
  if p_actor_bucket !~ '^[0-9a-f]{64}$' or p_network_bucket !~ '^[0-9a-f]{64}$'
     or p_window_seconds not between 10 and 3600
     or p_actor_limit not between 1 and 100 or p_network_limit not between 1 and 1000 then
    raise exception 'invalid rate-limit request' using errcode = 'HB400';
  end if;

  -- Buckets are pseudonymous abuse-control data, not an activity log.
  delete from private.booking_rate_limits where updated_at < p_now - interval '1 day';

  insert into private.booking_rate_limits (bucket_kind, bucket_hash, window_started_at, attempts)
  values ('actor', p_actor_bucket, p_now, 1)
  on conflict (bucket_kind, bucket_hash) do update
  set window_started_at = case
        when private.booking_rate_limits.window_started_at <= p_now - make_interval(secs => p_window_seconds) then p_now
        else private.booking_rate_limits.window_started_at end,
      attempts = case
        when private.booking_rate_limits.window_started_at <= p_now - make_interval(secs => p_window_seconds) then 1
        else private.booking_rate_limits.attempts + 1 end,
      updated_at = now()
  returning attempts into v_actor_attempts;
  if v_actor_attempts > p_actor_limit then
    raise exception 'too many booking attempts' using errcode = 'HB429';
  end if;

  insert into private.booking_rate_limits (bucket_kind, bucket_hash, window_started_at, attempts)
  values ('network', p_network_bucket, p_now, 1)
  on conflict (bucket_kind, bucket_hash) do update
  set window_started_at = case
        when private.booking_rate_limits.window_started_at <= p_now - make_interval(secs => p_window_seconds) then p_now
        else private.booking_rate_limits.window_started_at end,
      attempts = case
        when private.booking_rate_limits.window_started_at <= p_now - make_interval(secs => p_window_seconds) then 1
        else private.booking_rate_limits.attempts + 1 end,
      updated_at = now()
  returning attempts into v_network_attempts;
  if v_network_attempts > p_network_limit then
    raise exception 'too many booking attempts' using errcode = 'HB429';
  end if;
  return true;
end;
$$;

create or replace function private.acquire_hold(
  p_unit_id          text,
  p_product_price_id uuid,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz,
  p_hold_minutes     integer default 10,
  p_customer_id      uuid default null,
  p_owner_token_hash text default null
) returns hub.reservations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_unit  hub.bookable_units;
  v_price hub.product_prices;
  v_prod  hub.products;
  v_range tstzrange;
  v_row   hub.reservations;
begin
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'the period must end after it starts' using errcode = 'HB400';
  end if;
  if p_ends_at <= now() then
    raise exception 'the period is in the past' using errcode = 'HB400';
  end if;
  if p_hold_minutes not between 1 and 60 then
    raise exception 'hold must be 1-60 minutes' using errcode = 'HB400';
  end if;
  if p_customer_id is null and p_owner_token_hash is null then
    raise exception 'a hold needs an owner' using errcode = 'HB400';
  end if;

  select * into v_unit from hub.bookable_units where id = p_unit_id;
  if not found or v_unit.retired_at is not null or not v_unit.is_bookable or not v_unit.is_public or not v_unit.verified then
    raise exception 'unit % is not bookable', p_unit_id using errcode = 'HB404';
  end if;

  -- Owner first, unit second: one lock order avoids cycles while making the three-hold cap
  -- correct even when the same visitor races requests against several different units.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('owner:' || coalesce(p_customer_id::text, p_owner_token_hash), 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('unit:' || p_unit_id, 0));

  select * into v_price from hub.product_prices where id = p_product_price_id and is_active;
  if not found then
    raise exception 'unknown or inactive price' using errcode = 'HB404';
  end if;
  select * into v_prod from hub.products where id = v_price.product_id and is_active;
  if not found or v_prod.unit_kind is distinct from v_unit.kind or v_prod.billing <> 'one_time' then
    raise exception 'price % cannot book a %', p_product_price_id, v_unit.kind using errcode = 'HB400';
  end if;

  v_range := tstzrange(p_starts_at, p_ends_at, '[)');
  if exists (select 1 from hub.closures c
             where (c.unit_id = v_unit.id or c.space_id = v_unit.space_id) and c.during && v_range) then
    raise exception 'unit % is closed for that period', p_unit_id using errcode = 'HB423';
  end if;

  update hub.reservations set status = 'expired'
  where unit_id = v_unit.id and status = 'held' and hold_expires_at <= now();

  if (select count(*) >= 3 from hub.reservations r
      where r.status = 'held' and r.hold_expires_at > now()
        and ((p_customer_id is not null and r.customer_id = p_customer_id)
          or (p_owner_token_hash is not null and r.owner_token_hash = p_owner_token_hash))) then
    raise exception 'too many concurrent holds for this owner' using errcode = 'HB429';
  end if;

  begin
    insert into hub.reservations (unit_id, product_price_id, customer_id, owner_token_hash, during,
                                  status, hold_expires_at, currency)
    values (v_unit.id, v_price.id, p_customer_id, p_owner_token_hash, v_range,
            'held', now() + make_interval(mins => p_hold_minutes), v_price.currency)
    returning * into v_row;
  exception when exclusion_violation then
    raise exception 'unit % is not available for that period', p_unit_id using errcode = 'HB409';
  end;
  return v_row;
end;
$$;

create function api.server_consume_booking_attempt(
  p_actor_bucket   text,
  p_network_bucket text
) returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.consume_booking_rate_limit(p_actor_bucket, p_network_bucket);
$$;

-- Anonymous owners should see their own live hold as `yours`, just like signed-in customers.
drop function private.unit_availability(text, timestamptz, timestamptz, uuid);
create function private.unit_availability(
  p_floor_id        text,
  p_starts_at       timestamptz,
  p_ends_at         timestamptz,
  p_customer_id     uuid default null,
  p_owner_token_hash text default null
) returns table (unit_id text, state text)
language sql
stable
security invoker
set search_path = ''
as $$
  with period as (select tstzrange(p_starts_at, p_ends_at, '[)') as r)
  select u.id,
    case
      when not u.is_bookable or not u.verified or u.retired_at is not null then 'not_bookable'
      when exists (select 1 from hub.closures c, period
                   where (c.unit_id = u.id or c.space_id = u.space_id) and c.during && period.r) then 'closed'
      when exists (
                   select 1 from hub.reservations r, period
                   where r.unit_id = u.id and r.during && period.r
                     and (r.status = 'confirmed' or (r.status = 'held' and r.hold_expires_at > now()))
                     and ((p_customer_id is not null and r.customer_id = p_customer_id)
                       or (p_owner_token_hash is not null and r.owner_token_hash = p_owner_token_hash))) then 'yours'
      when exists (select 1 from hub.reservations r, period
                   where r.unit_id = u.id and r.status = 'confirmed' and r.during && period.r) then 'unavailable'
      when exists (select 1 from hub.reservations r, period
                   where r.unit_id = u.id and r.status = 'held' and r.hold_expires_at > now()
                     and r.during && period.r) then 'held'
      else 'available'
    end
  from hub.bookable_units u
  where u.floor_id = p_floor_id and u.is_public
  order by u.id;
$$;

-- Checkout attachment is ownership-sensitive too. A reservation id alone is not authority.
drop function private.attach_checkout_session(uuid, text, timestamptz);
create function private.attach_checkout_session(
  p_reservation_id     uuid,
  p_session_id         text,
  p_session_expires_at timestamptz,
  p_owner_token_hash   text default null,
  p_customer_id        uuid default null
) returns hub.reservations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row hub.reservations;
begin
  select * into v_row from hub.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'hold % is no longer held', p_reservation_id using errcode = 'HB410';
  end if;
  if not (   (p_owner_token_hash is not null and v_row.owner_token_hash = p_owner_token_hash)
          or (p_customer_id is not null and v_row.customer_id = p_customer_id)) then
    raise exception 'not the owner of this hold' using errcode = 'HB403';
  end if;
  if v_row.status <> 'held' or v_row.hold_expires_at <= now() then
    raise exception 'hold % is no longer held', p_reservation_id using errcode = 'HB410';
  end if;
  if p_session_expires_at is null or p_session_expires_at <= now() then
    raise exception 'session expiry must be in the future' using errcode = 'HB400';
  end if;

  update hub.reservations
  set stripe_checkout_session_id = p_session_id,
      hold_expires_at = greatest(hold_expires_at, p_session_expires_at + interval '2 minutes')
  where id = p_reservation_id
  returning * into v_row;
  return v_row;
end;
$$;

create function api.server_unit_availability(
  p_floor_id         text,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz,
  p_customer_id      uuid default null,
  p_owner_token_hash text default null
) returns table (unit_id text, state text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.unit_availability(
    p_floor_id, p_starts_at, p_ends_at, p_customer_id, p_owner_token_hash
  );
$$;

-- The caller names a product, never an amount or Stripe Price id. The active environment
-- price is selected inside the database and then snapshotted by private.acquire_hold.
create function api.server_acquire_hold(
  p_unit_id          text,
  p_product_id       text,
  p_environment      text,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz,
  p_hold_minutes     integer,
  p_customer_id      uuid default null,
  p_owner_token_hash text default null
) returns table (reservation_id uuid, unit_id text, hold_expires_at timestamptz)
language sql
volatile
security invoker
set search_path = ''
as $$
  select r.id, r.unit_id, r.hold_expires_at
  from private.acquire_hold(
    p_unit_id,
    (select pp.id from hub.product_prices pp
     join hub.products p on p.id = pp.product_id
     where pp.product_id = p_product_id and pp.environment = p_environment
       and pp.is_active and p.is_active),
    p_starts_at, p_ends_at, p_hold_minutes, p_customer_id, p_owner_token_hash
  ) r;
$$;

create function api.server_release_hold(
  p_reservation_id   uuid,
  p_owner_token_hash text default null,
  p_customer_id      uuid default null
) returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.release_hold(p_reservation_id, p_owner_token_hash, p_customer_id);
$$;

-- Reserved for the payment phase. It is safe to expose to the Next.js server now because
-- ownership is rechecked in private.attach_checkout_session before any mutation.
create function api.server_attach_checkout_session(
  p_reservation_id     uuid,
  p_session_id         text,
  p_session_expires_at timestamptz,
  p_owner_token_hash   text default null,
  p_customer_id        uuid default null
) returns table (reservation_id uuid, hold_expires_at timestamptz)
language sql
volatile
security invoker
set search_path = ''
as $$
  select r.id, r.hold_expires_at
  from private.attach_checkout_session(
    p_reservation_id, p_session_id, p_session_expires_at, p_owner_token_hash, p_customer_id
  ) r;
$$;

revoke execute on all functions in schema api from public, anon, authenticated;
revoke all on private.booking_rate_limits from public, anon, authenticated;
revoke execute on function private.consume_booking_rate_limit(text, text, timestamptz, integer, integer, integer) from public, anon, authenticated;
revoke execute on function private.unit_availability(text, timestamptz, timestamptz, uuid, text) from public, anon, authenticated;
revoke execute on function private.attach_checkout_session(uuid, text, timestamptz, text, uuid) from public, anon, authenticated;

grant execute on function
  private.consume_booking_rate_limit(text, text, timestamptz, integer, integer, integer),
  private.unit_availability(text, timestamptz, timestamptz, uuid, text),
  private.attach_checkout_session(uuid, text, timestamptz, text, uuid),
  api.server_unit_availability(text, timestamptz, timestamptz, uuid, text),
  api.server_consume_booking_attempt(text, text),
  api.server_acquire_hold(text, text, text, timestamptz, timestamptz, integer, uuid, text),
  api.server_release_hold(uuid, text, uuid),
  api.server_attach_checkout_session(uuid, text, timestamptz, text, uuid)
to service_role;

grant select, insert, update, delete on private.booking_rate_limits to service_role;
