-- HR-provisioned accounts, and the password-change flag.
--
-- Replaces 05_signin_link.sql, which tested the magic-link trigger that
-- linked an auth user to a person created independently. Nothing is created
-- independently any more — HR makes both in one call — so that trigger and
-- its test are gone together.
--
-- What matters now is that provisioning belongs to HR alone, that it cannot
-- reach into another organisation, and that the flag forcing a new password
-- can only ever be cleared by the person carrying it.
begin;
select plan(9);

create temp table res(i int, r text) on commit drop;
grant all on res to authenticated;

insert into identity.orgs (id, name) values
  ('e0000000-0000-0000-0000-0000000000aa', 'Org A'),
  ('e0000000-0000-0000-0000-0000000000bb', 'Org B');

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-000000000001', 'hr@orga.example'),
  ('f0000000-0000-0000-0000-000000000002', 'emp@orga.example'),
  ('f0000000-0000-0000-0000-000000000003', 'new@orga.example'),
  ('f0000000-0000-0000-0000-000000000004', 'hrb@orgb.example');

-- HR of Org A, an ordinary employee of Org A, and HR of Org B.
insert into identity.people (id, org_id, auth_user_id, email, full_name, status, must_change_password) values
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000aa',
   'f0000000-0000-0000-0000-000000000001', 'hr@orga.example', 'Ada HR', 'active', false),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000aa',
   'f0000000-0000-0000-0000-000000000002', 'emp@orga.example', 'Eve Employee', 'active', true),
  ('a0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-0000000000bb',
   'f0000000-0000-0000-0000-000000000004', 'hrb@orgb.example', 'Bo HR', 'active', false);

insert into identity.person_roles (person_id, role) values
  ('a0000000-0000-0000-0000-000000000001', 'employee'),
  ('a0000000-0000-0000-0000-000000000001', 'hr'),
  ('a0000000-0000-0000-0000-000000000002', 'employee'),
  ('a0000000-0000-0000-0000-000000000004', 'employee'),
  ('a0000000-0000-0000-0000-000000000004', 'hr');

-- ------------------------------------------------- an employee cannot provision

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000002"}';

insert into res select 1, throws_ok(
  $$ select public.provision_person(
       'f0000000-0000-0000-0000-000000000003'::uuid, 'Nina New', 'Nurse', 'Care', false) $$,
  '42501',
  'only HR can create an account',
  'an employee cannot provision anyone');

-- The flag is theirs to clear, and clearing it is all they can do. Both
-- reads here are columns identity.people grants to authenticated
-- (must_change_password, id) — auth_user_id and email are not, and stay
-- checked from the superuser role further down, the same as the rest of
-- this schema's tests already do.
insert into res select 2, is(
  (select must_change_password from identity.people
    where id = 'a0000000-0000-0000-0000-000000000002'),
  true,
  'the employee starts out having to change their password');

insert into res select 3, lives_ok(
  $$ select public.clear_password_change_flag() $$,
  'a person can clear their own flag');

insert into res select 4, is(
  (select must_change_password from identity.people
    where id = 'a0000000-0000-0000-0000-000000000002'),
  false,
  'clearing it works on the caller''s own row');

-- Their own call must not have touched anybody else. HR of Org A was
-- already false, so set it true first and prove it survives.
reset role;
update identity.people set must_change_password = true
 where id = 'a0000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000002"}';
insert into res select 5, lives_ok(
  $$ select public.clear_password_change_flag() $$,
  'clearing twice is harmless');

reset role;
insert into res select 6, is(
  (select must_change_password from identity.people
    where id = 'a0000000-0000-0000-0000-000000000001'),
  true,
  'clearing your own flag leaves everyone else''s alone');

-- ------------------------------------------------------ HR can provision, once

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000001"}';

insert into res select 7, lives_ok(
  $$ select public.provision_person(
       'f0000000-0000-0000-0000-000000000003'::uuid, 'Nina New', 'Nurse', 'Care', false) $$,
  'HR can create an account');

-- --------------------------------------------- and never across organisations

set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000004"}';

insert into res select 9, throws_ok(
  $$ select public.begin_password_reset('a0000000-0000-0000-0000-000000000002'::uuid) $$,
  '42501',
  'that person is not at your organisation',
  'HR of another org cannot reset someone''s password');

reset role;

-- Linked at insert, not left null for a trigger to fill in later — the
-- difference that let the linking triggers be dropped. auth_user_id is not
-- granted to authenticated, so this is checked from the superuser role like
-- the rest of this schema's boundary tests do.
insert into res select 8, is(
  (select auth_user_id from identity.people where lower(email) = 'new@orga.example'),
  'f0000000-0000-0000-0000-000000000003'::uuid,
  'the new person is linked to their sign-in at creation');

select count(*) as total,
       count(*) filter (where r like 'not ok%') as failures,
       coalesce(string_agg(r, ' | ' order by i) filter (where r like 'not ok%'), 'ALL PASS') as detail
from res;
rollback;
