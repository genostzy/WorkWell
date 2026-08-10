begin;
select plan(6);

select has_function('identity', 'current_person_id', 'resolver for person exists');
select has_function('identity', 'current_org_id',    'resolver for org exists');

-- security definer is required: RLS on identity.people would otherwise
-- recurse, since a policy on people would call a function reading people.
select is(
  (select prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'identity' and p.proname = 'current_person_id'),
  true,
  'current_person_id is security definer'
);

-- A security definer function without a pinned search_path is a
-- privilege-escalation vector.
--
-- Postgres serialises `set search_path = ''` into proconfig as
-- search_path="" (a quoted empty string), not search_path=. Accept both
-- spellings with the array-overlap operator so the assertion tests the
-- property rather than one version's formatting.
select ok(
  (select proconfig from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'identity' and p.proname = 'current_person_id')
  && array['search_path=', 'search_path=""'],
  'current_person_id pins search_path to empty'
);
select ok(
  (select proconfig from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'identity' and p.proname = 'current_org_id')
  && array['search_path=', 'search_path=""'],
  'current_org_id pins search_path to empty'
);

-- stable lets Postgres evaluate once per query instead of once per row.
select is(
  (select provolatile from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'identity' and p.proname = 'current_person_id'),
  's'::"char",
  'current_person_id is stable'
);

select * from finish();
rollback;
