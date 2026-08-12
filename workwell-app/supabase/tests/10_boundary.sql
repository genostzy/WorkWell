-- The boundary, asserted as it actually stands.
--
-- This file used to assert that no API role held any grant inside private,
-- work or org_agg. That was true while those schemas were empty and became
-- false the moment an employee needed to read their own check-ins. Schema
-- closure was always a proxy; the real guarantee is that every table in
-- those schemas is governed by RLS, and that the per-table tests
-- (11_private_plane, 12_planes, 13_slice_f) prove who can read what.
--
-- What is asserted here is the structural floor: nothing in a plane schema
-- is ungoverned, and no view can bypass the policies.
begin;
select plan(9);

create temp table res(i int, r text) on commit drop;
grant all on res to authenticated;

insert into identity.orgs (id, name) values
  ('c0000000-0000-0000-0000-00000000000a', 'Org A'),
  ('c0000000-0000-0000-0000-00000000000b', 'Org B');

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-00000000000a', 'a@orga.example'),
  ('d0000000-0000-0000-0000-0000000000ff', 'orphan@nowhere.example');

insert into identity.people (org_id, auth_user_id, email, full_name, status) values
  ('c0000000-0000-0000-0000-00000000000a',
   'd0000000-0000-0000-0000-00000000000a', 'a@orga.example', 'Person A', 'active'),
  ('c0000000-0000-0000-0000-00000000000b',
   null, 'b@orgb.example', 'Person B', 'invited');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-00000000000a"}';

insert into res select 1, is((select count(*)::int from identity.people), 1,
  'a person sees only their own org');
insert into res select 2, is((select count(*)::int from identity.orgs), 1,
  'a person sees only their own org row');

set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-0000000000ff"}';

insert into res select 3, is(identity.current_person_id(), null,
  'an uninvited account resolves to no person');
insert into res select 4, is((select count(*)::int from identity.people), 0,
  'an uninvited account sees no people');

reset role;

-- The structural floor. Every table in a plane schema is governed, so a
-- table added without RLS fails here rather than shipping open.
insert into res select 5, is(
  (select count(*)::int from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('private','work','org_agg')
      and c.relkind = 'r'
      and not c.relrowsecurity),
  0,
  'every table in private, work and org_agg has RLS enabled');

-- RLS on with no policy denies everything, which is safe but is almost
-- always an oversight rather than a decision.
insert into res select 6, is(
  (select count(*)::int from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('private','work','org_agg')
      and c.relkind = 'r'
      and c.relrowsecurity
      and not exists (
        select 1 from pg_policies p
         where p.schemaname = n.nspname and p.tablename = c.relname)),
  0,
  'every governed table actually carries a policy');

-- A view is security definer by default. One added to public without
-- security_invoker runs as its owner and returns every row, bypassing
-- every policy above it.
insert into res select 7, is(
  (select count(*)::int from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and array_to_string(coalesce(c.reloptions, '{}'::text[]), ',')
          !~ 'security_invoker=(true|on)'),
  0,
  'every view in public sets security_invoker');

-- The aggregation routine reads check-ins in bulk. No HTTP-reachable role
-- may ever be able to call it.
insert into res select 8, ok(
  not has_function_privilege('authenticated', 'org_agg.refresh(int)', 'execute')
  and not has_function_privilege('anon', 'org_agg.refresh(int)', 'execute'),
  'no API role can execute the aggregation routine');

-- Every RPC guards itself by resolving the caller first, so an anon call
-- raises rather than writing. That is one layer, and it is the layer most
-- likely to be got wrong in a hurry. Supabase's default privileges grant
-- EXECUTE on new public functions to anon directly, which `revoke from
-- public` does not undo — so this has to be asserted rather than assumed.
insert into res select 9, is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')),
  0,
  'no function in public is executable by anon');

select count(*) as total,
       count(*) filter (where r like 'not ok%') as failures,
       coalesce(string_agg(r, ' | ' order by i) filter (where r like 'not ok%'), 'ALL PASS') as detail
from res;
rollback;
