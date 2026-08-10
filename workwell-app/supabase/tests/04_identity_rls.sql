begin;
select plan(7);

select ok(
  (select relrowsecurity from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='identity' and c.relname='people'),
  'RLS is enabled on people'
);
select ok(
  (select relrowsecurity from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='identity' and c.relname='person_roles'),
  'RLS is enabled on person_roles'
);
select ok(
  (select relrowsecurity from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='identity' and c.relname='orgs'),
  'RLS is enabled on orgs'
);

select policies_are('identity', 'people',
  array['people_read_own_org'], 'people has exactly its read policy');
select policies_are('identity', 'person_roles',
  array['roles_read_own'], 'person_roles has exactly its read policy');
select policies_are('identity', 'orgs',
  array['orgs_read_own'], 'orgs has exactly its read policy');

-- Bare auth.uid() is evaluated per row. Supabase measures 179ms vs 9ms
-- against the wrapped form, so this is a correctness-of-performance rule.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'identity'
      and (qual like '%auth.uid()%' and qual not like '%( SELECT auth.uid()%')),
  0,
  'no policy calls auth.uid() unwrapped'
);

select * from finish();
rollback;
