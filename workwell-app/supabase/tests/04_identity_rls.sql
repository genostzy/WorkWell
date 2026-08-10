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
-- Checked across with_check as well as qual, and across every schema, not
-- just identity, since the rule applies everywhere.
select is(
  (select count(*)::int from pg_policies
    where coalesce(qual,'') || coalesce(with_check,'') like '%auth.uid()%'
      and coalesce(qual,'') || coalesce(with_check,'') not like '%( SELECT auth.uid()%'),
  0,
  'no policy anywhere calls auth.uid() unwrapped'
);

select * from finish();
rollback;
