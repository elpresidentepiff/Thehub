-- Local stand-in for the objects a Supabase project provides before any migration runs.
-- Used ONLY by scripts/db-test.mjs on a throwaway Postgres cluster. Never a migration.
--
-- Mirrors Supabase closely enough for the Hub migrations and tests:
--   roles anon / authenticated / service_role (service_role bypasses RLS, as on Supabase)
--   schema extensions, auth.users, auth.uid(), auth.jwt() reading request.jwt.claims

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
grant anon, authenticated, service_role to current_user;

create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_app_meta_data  jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
             (select auth.jwt()) ->> 'sub'),
    '')::uuid;
$$;

grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;
