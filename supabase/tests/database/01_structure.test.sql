-- Structural guarantees: the things a later migration must never quietly undo.
begin;
select plan(12);

select has_schema('hub');
select has_schema('private');
select has_schema('api');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('hub', 'private') and c.relkind = 'r' and not c.relrowsecurity),
  0, 'every table in hub and private has row level security enabled');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'api' and c.relkind = 'r'),
  0, 'the exposed api schema contains no tables, only views');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'api' and c.relkind = 'v'
     and not coalesce('security_invoker=true' = any (c.reloptions), false)),
  0, 'every api view is security_invoker (views bypass RLS otherwise)');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('hub', 'private', 'api') and p.prosecdef),
  0, 'no security definer functions anywhere in the Hub schemas');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('hub', 'private', 'api')
     and not coalesce('search_path=""' = any (p.proconfig), false)),
  0, 'every Hub function pins an empty search_path');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute'))),
  0, 'no private function is executable by anon or authenticated');

select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'hub.reservations'::regclass and conname = 'no_double_booking' and contype = 'x'),
  1, 'reservations carry the no_double_booking exclusion constraint');

select is(
  (select extnamespace::regnamespace::text from pg_extension where extname = 'btree_gist'),
  'extensions', 'btree_gist is installed in the extensions schema');

select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'hub' and grantee in ('anon', 'authenticated')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  0, 'clients hold no write privilege on any hub table');

select * from finish();
rollback;
