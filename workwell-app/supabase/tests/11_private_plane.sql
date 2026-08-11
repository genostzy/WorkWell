-- The assertion the whole product exists to make true.
--
-- Deliberately same-org: cross-org isolation is already proven in
-- 10_boundary.sql, and the interesting case is the one the org chart
-- permits. HR can see this person in the directory. HR must not see how
-- their week went.
begin;
select plan(6);

create temp table res(i int, r text) on commit drop;
grant all on res to authenticated;

insert into identity.orgs (id, name)
  values ('e1000000-0000-0000-0000-00000000000e', 'Same Org');

insert into auth.users (id, email) values
  ('e2000000-0000-0000-0000-00000000000a', 'employee@same.example'),
  ('e2000000-0000-0000-0000-00000000000h', 'hr@same.example');

insert into identity.people (id, org_id, auth_user_id, email, full_name, status) values
  ('e3000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-00000000000e',
   'e2000000-0000-0000-0000-00000000000a', 'employee@same.example', 'The Employee', 'active'),
  ('e3000000-0000-0000-0000-00000000000h', 'e1000000-0000-0000-0000-00000000000e',
   'e2000000-0000-0000-0000-00000000000h', 'hr@same.example', 'The HR Lead', 'active');

insert into identity.person_roles (person_id, role) values
  ('e3000000-0000-0000-0000-00000000000a', 'employee'),
  ('e3000000-0000-0000-0000-00000000000h', 'employee'),
  ('e3000000-0000-0000-0000-00000000000h', 'hr');

insert into private.check_ins (person_id, day, mood, energy, pressure, note)
  values ('e3000000-0000-0000-0000-00000000000a', current_date, 2, 2, 5,
          'Rough week, too much on.');

-- The employee sees their own entry.
set local role authenticated;
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-00000000000a"}';
insert into res select 1, is((select count(*)::int from public.check_ins), 1,
  'the employee reads their own check-in');
insert into res select 2, is((select note from public.check_ins), 'Rough week, too much on.',
  'and can read what they wrote');

-- HR, in the same org, holding the hr role, sees nothing at all.
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-00000000000h"}';
insert into res select 3, is((select count(*)::int from public.check_ins), 0,
  'HR in the same org reads zero check-ins');
insert into res select 4, is((select count(*)::int from private.check_ins), 0,
  'HR reads zero even going straight at the private table');

-- HR can still see that person exists. The directory is not the diary.
insert into res select 5, is((select count(*)::int from public.people), 2,
  'HR still sees both people in the directory');

-- And HR cannot write a row on someone else's behalf.
insert into res select 6, throws_ok(
  $$ insert into private.check_ins (person_id, day, mood)
     values ('e3000000-0000-0000-0000-00000000000a', current_date - 1, 5) $$,
  '42501',
  null,
  'HR cannot write a check-in as someone else');

reset role;

select count(*) as total,
       count(*) filter (where r like 'not ok%') as failures,
       coalesce(string_agg(r, ' | ' order by i) filter (where r like 'not ok%'), 'ALL PASS') as detail
from res;
rollback;
