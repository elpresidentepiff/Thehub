-- The Hub — booking operations.
--
-- Server-only. Every function here lives in `private` (never exposed), runs as SECURITY
-- INVOKER with an empty search_path, and is executable only by service_role (granted in
-- the access-control migration). The browser reaches them through Next.js route handlers,
-- never directly.
--
-- Errors carry Hub SQLSTATEs so the server can map them without parsing text:
--   HB400 invalid request      HB403 not the owner         HB404 unknown unit/price
--   HB409 slot unavailable     HB410 hold no longer held   HB423 closed for that period

-- ---------------------------------------------------------------------------------------
-- Inventory seed: upsert the registry JSON (data/inventory/*.json). Idempotent.
-- Units missing from the registry are left alone; retire them explicitly.
-- ---------------------------------------------------------------------------------------
create function private.upsert_inventory(p_registry jsonb) returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_floor jsonb := p_registry -> 'floor';
  v_count integer;
begin
  insert into hub.floors (id, name, plan_revision, plan_asset_path, width_m, height_m)
  values (v_floor ->> 'id', v_floor ->> 'name', v_floor ->> 'plan_revision', v_floor ->> 'plan_asset',
          (v_floor ->> 'width_m')::numeric, (v_floor ->> 'height_m')::numeric)
  on conflict (id) do update set name = excluded.name, plan_revision = excluded.plan_revision,
    plan_asset_path = excluded.plan_asset_path, width_m = excluded.width_m, height_m = excluded.height_m;

  insert into hub.spaces (id, floor_id, kind, name)
  select s ->> 'id', v_floor ->> 'id', s ->> 'kind', s ->> 'name'
  from jsonb_array_elements(p_registry -> 'spaces') s
  on conflict (id) do update set kind = excluded.kind, name = excluded.name;

  insert into hub.bookable_units (id, floor_id, space_id, kind, label, capacity, x_m, y_m, rot_deg,
                                  footprint, is_bookable, verified, retired_at)
  select u ->> 'id', v_floor ->> 'id', u ->> 'space_id', u ->> 'kind', u ->> 'label',
         (u ->> 'capacity')::integer, (u ->> 'x_m')::numeric, (u ->> 'y_m')::numeric,
         coalesce((u ->> 'rot_deg')::numeric, 0), u -> 'footprint',
         coalesce((u ->> 'bookable')::boolean, true), coalesce((u ->> 'verified')::boolean, false),
         case when coalesce((u ->> 'retired')::boolean, false) then now() end
  from jsonb_array_elements(p_registry -> 'units') u
  on conflict (id) do update set
    space_id = excluded.space_id, label = excluded.label, capacity = excluded.capacity,
    x_m = excluded.x_m, y_m = excluded.y_m, rot_deg = excluded.rot_deg, footprint = excluded.footprint,
    is_bookable = excluded.is_bookable, verified = excluded.verified,
    retired_at = coalesce(hub.bookable_units.retired_at, excluded.retired_at);
  -- kind is deliberately not updated: an id never changes what it is.

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Holds
-- ---------------------------------------------------------------------------------------

-- Take a unit for [p_starts_at, p_ends_at). Short hold; attach_checkout_session extends it
-- to cover Stripe's Checkout window (Stripe sessions live at least 30 minutes).
create function private.acquire_hold(
  p_unit_id          text,
  p_product_price_id uuid,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz,
  p_hold_minutes     integer default 10,
  p_customer_id      uuid default null,
  p_owner_token_hash text default null
) returns hub.reservations
language plpgsql
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
  if not found or v_unit.retired_at is not null or not v_unit.is_bookable then
    raise exception 'unit % is not bookable', p_unit_id using errcode = 'HB404';
  end if;

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

  -- Lapsed holds stop blocking the moment anyone asks for the unit.
  update hub.reservations set status = 'expired'
  where unit_id = v_unit.id and status = 'held' and hold_expires_at <= now();

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

create function private.release_hold(
  p_reservation_id   uuid,
  p_owner_token_hash text default null,
  p_customer_id      uuid default null
) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_row hub.reservations;
begin
  select * into v_row from hub.reservations where id = p_reservation_id for update;
  if not found then
    return false;
  end if;
  if not (   (p_owner_token_hash is not null and v_row.owner_token_hash = p_owner_token_hash)
          or (p_customer_id is not null and v_row.customer_id = p_customer_id)) then
    raise exception 'not the owner of this hold' using errcode = 'HB403';
  end if;
  if v_row.status <> 'held' then
    return false;  -- already released, expired or paid: releasing again is a no-op
  end if;
  update hub.reservations set status = 'released' where id = p_reservation_id;
  return true;
end;
$$;

-- Bind a Stripe Checkout Session to a live hold, and stretch the hold to outlive the
-- session so a visitor can never pay for a slot that lapsed mid-payment.
create function private.attach_checkout_session(
  p_reservation_id     uuid,
  p_session_id         text,
  p_session_expires_at timestamptz
) returns hub.reservations
language plpgsql
set search_path = ''
as $$
declare
  v_row hub.reservations;
begin
  select * into v_row from hub.reservations where id = p_reservation_id for update;
  if not found or v_row.status <> 'held' or v_row.hold_expires_at <= now() then
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

-- ---------------------------------------------------------------------------------------
-- Stripe webhooks: record once, then act. Every transition is safe to replay.
-- ---------------------------------------------------------------------------------------

-- true = process this event now; false = already processed (duplicate delivery).
create function private.record_stripe_event(
  p_event_id       text,
  p_type           text,
  p_livemode       boolean,
  p_object_id      text,
  p_payload_sha256 text
) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  insert into private.stripe_events (id, type, livemode, object_id, payload_sha256)
  values (p_event_id, p_type, p_livemode, p_object_id, p_payload_sha256)
  on conflict (id) do nothing;
  if found then
    return true;
  end if;
  select status into v_status from private.stripe_events where id = p_event_id for update;
  return v_status in ('received', 'failed');  -- a crashed or failed attempt may be retried
end;
$$;

create function private.finish_stripe_event(
  p_event_id text,
  p_status   text,
  p_outcome  text default null,
  p_error    text default null
) returns void
language sql
set search_path = ''
as $$
  update private.stripe_events
  set status = p_status, outcome = p_outcome, error = p_error, processed_at = now()
  where id = p_event_id;
$$;

-- checkout.session.completed (paid) / async_payment_succeeded.
-- Returns what happened; the caller records it on the event and alerts on conflicts.
create function private.confirm_from_checkout(
  p_session_id        text,
  p_customer_id       uuid,
  p_payment_intent_id text,
  p_amount_total      integer,
  p_currency          text
) returns text
language plpgsql
set search_path = ''
as $$
declare
  v_row hub.reservations;
begin
  if p_customer_id is null then
    raise exception 'a confirmed booking needs a customer' using errcode = 'HB400';
  end if;

  select * into v_row from hub.reservations where stripe_checkout_session_id = p_session_id for update;
  if not found then
    return 'unknown_session';
  end if;
  if v_row.status in ('confirmed', 'completed') then
    return 'already_confirmed';
  end if;
  if v_row.status not in ('held', 'expired', 'released') then
    return 'ignored_' || v_row.status;
  end if;

  begin
    update hub.reservations
    set status = 'confirmed',
        customer_id = coalesce(customer_id, p_customer_id),
        stripe_payment_intent_id = p_payment_intent_id,
        amount_total = p_amount_total,
        currency = p_currency,
        hold_expires_at = null
    where id = v_row.id;
  exception when exclusion_violation then
    -- Paid, but the hold had lapsed and someone else now has the slot.
    update hub.reservations
    set needs_refund = true,
        customer_id = coalesce(customer_id, p_customer_id),
        stripe_payment_intent_id = p_payment_intent_id,
        amount_total = p_amount_total,
        currency = p_currency
    where id = v_row.id;
    return 'conflict_refund_required';
  end;

  return case when v_row.status = 'held' then 'confirmed' else 'confirmed_after_expiry' end;
end;
$$;

-- checkout.session.expired / async_payment_failed.
create function private.expire_checkout(p_session_id text) returns text
language plpgsql
set search_path = ''
as $$
begin
  update hub.reservations set status = 'expired'
  where stripe_checkout_session_id = p_session_id and status = 'held';
  return case when found then 'expired' else 'noop' end;
end;
$$;

-- For a scheduled job (pg_cron) once a Supabase project exists; acquire_hold also sweeps
-- per unit, so correctness never depends on this running.
create function private.sweep_expired_holds() returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  update hub.reservations set status = 'expired'
  where status = 'held' and hold_expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Availability read model for the floor picker. Never returns who holds or booked a unit.
--   not_bookable > closed > yours > unavailable > held > available
-- ---------------------------------------------------------------------------------------
create function private.unit_availability(
  p_floor_id    text,
  p_starts_at   timestamptz,
  p_ends_at     timestamptz,
  p_customer_id uuid default null
) returns table (unit_id text, state text)
language sql
stable
set search_path = ''
as $$
  with period as (select tstzrange(p_starts_at, p_ends_at, '[)') as r)
  select u.id,
    case
      when not u.is_bookable or u.retired_at is not null then 'not_bookable'
      when exists (select 1 from hub.closures c, period
                   where (c.unit_id = u.id or c.space_id = u.space_id) and c.during && period.r) then 'closed'
      when p_customer_id is not null and exists (
                   select 1 from hub.reservations r, period
                   where r.unit_id = u.id and r.customer_id = p_customer_id and r.during && period.r
                     and (r.status = 'confirmed' or (r.status = 'held' and r.hold_expires_at > now()))) then 'yours'
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

-- Find or create the operational customer for a Checkout completion. Matches on Stripe
-- customer, then signed-in user. Never merges strangers by email.
create function private.ensure_customer(
  p_email              text,
  p_full_name          text default null,
  p_stripe_customer_id text default null,
  p_user_id            uuid default null
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_stripe_customer_id is not null then
    select id into v_id from hub.customers where stripe_customer_id = p_stripe_customer_id;
  end if;
  if v_id is null and p_user_id is not null then
    select id into v_id from hub.customers where user_id = p_user_id;
    if v_id is not null and p_stripe_customer_id is not null then
      update hub.customers set stripe_customer_id = coalesce(stripe_customer_id, p_stripe_customer_id)
      where id = v_id;
    end if;
  end if;
  if v_id is null then
    insert into hub.customers (email, full_name, stripe_customer_id, user_id)
    values (p_email, p_full_name, p_stripe_customer_id, p_user_id)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
