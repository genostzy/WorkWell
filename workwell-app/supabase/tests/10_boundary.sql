begin;
select plan(6);

-- Two orgs, one person each, to prove tenancy holds.
insert into identity.orgs (id, name) values
  ('c0000000-0000-0000-0000-00000000000a', 'Org A'),
  ('c0000000-0000-0000-0000-00000000000b', 'Org B');

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-00000000000a', 'a@orga.example'),
  ('d0000000-0000-0000-0000-00000000000b', 'b@orgb.example'),
  ('d0000000-0000-0000-0000-0000000000ff', 'orphan@nowhere.example');

insert into identity.people (org_id, auth_user_id, email, full_name, status) values
  ('c0000000-0000-0000-0000-00000000000a',
   'd0000000-0000-0000-0000-00000000000a', 'a@orga.example', 'Person A', 'active'),
  ('c0000000-0000-0000-0000-00000000000b',
   'd0000000-0000-0000-0000-00000000000b', 'b@orgb.example', 'Person B', 'active');

-- Cross-org isolation.
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-00000000000a"}';

select is((select count(*)::int from identity.people), 1,
          'a person sees only their own org');
select is((select count(*)::int from identity.orgs), 1,
          'a person sees only their own org row');

-- The orphan: an auth user with no invitation.
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-0000000000ff"}';

select is(identity.current_person_id(), null,
          'an uninvited account resolves to no person');
select is((select count(*)::int from identity.people), 0,
          'an uninvited account sees no people');

reset role;

-- The private schema stays shut, checked at two levels because they bite
-- at different times.
--
-- Schema level: meaningful right now. Without usage on the schema, no API
-- role can reach anything inside it regardless of table grants.
select ok(
  not has_schema_privilege('authenticated', 'private', 'usage')
  and not has_schema_privilege('anon', 'private', 'usage'),
  'no API role can enter the private schema'
);

-- Table level: vacuous while private is empty, because role_table_grants
-- only lists real tables. It is here so that the moment slice B adds its
-- first table, a stray grant on it fails this suite rather than shipping.
select is(
  (select count(*)::int
     from information_schema.role_table_grants
    where table_schema = 'private'
      and grantee in ('anon','authenticated')),
  0,
  'no API role holds any grant inside the private schema'
);

select * from finish();
rollback;
