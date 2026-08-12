-- The assertion the whole product exists to make true.
--
-- Deliberately same-org: cross-org isolation is already proven in
-- 10_boundary.sql, and the interesting case is the one the org chart
-- permits. HR can see this person in the directory. HR must not see how
-- their week went.
--
-- The HR ids end in b, not h. h is not a hex digit, and every id here ended
-- in one until it was noticed — so this file raised 22P02 on its first
-- insert and asserted nothing at all, for as long as it has existed. It
-- passes now, which is the first time that sentence has been true.
begin;
select plan(9);

create temp table res(i int, r text) on commit drop;
grant all on res to authenticated;

insert into identity.orgs (id, name)
  values ('e1000000-0000-0000-0000-00000000000e', 'Same Org');

insert into auth.users (id, email) values
  ('e2000000-0000-0000-0000-00000000000a', 'employee@same.example'),
  ('e2000000-0000-0000-0000-00000000000b', 'hr@same.example');

insert into identity.people (id, org_id, auth_user_id, email, full_name, status) values
  ('e3000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-00000000000e',
   'e2000000-0000-0000-0000-00000000000a', 'employee@same.example', 'The Employee', 'active'),
  ('e3000000-0000-0000-0000-00000000000b', 'e1000000-0000-0000-0000-00000000000e',
   'e2000000-0000-0000-0000-00000000000b', 'hr@same.example', 'The HR Lead', 'active');

insert into identity.person_roles (person_id, role) values
  ('e3000000-0000-0000-0000-00000000000a', 'employee'),
  ('e3000000-0000-0000-0000-00000000000b', 'employee'),
  ('e3000000-0000-0000-0000-00000000000b', 'hr');

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
insert into res select 7, is((select count(*)::int from public.person_roles), 1,
  'an employee reads only their own roles');

-- HR, in the same org, holding the hr role, sees nothing at all.
--
-- This id is the reason the whole file matters. Point it at an account that
-- does not resolve and every assertion below still passes — zero check-ins,
-- because the reader is nobody rather than because the reader is HR. So the
-- role is asserted first, and the rest is only meaningful after it.
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-00000000000b"}';
insert into res select 9, ok(identity.is_hr(),
  'the reader below genuinely holds the hr role');
insert into res select 3, is((select count(*)::int from public.check_ins), 0,
  'HR in the same org reads zero check-ins');
insert into res select 4, is((select count(*)::int from private.check_ins), 0,
  'HR reads zero even going straight at the private table');

-- HR can still see that person exists. The directory is not the diary.
insert into res select 5, is((select count(*)::int from public.people), 2,
  'HR still sees both people in the directory');

-- 0019 let HR read the org's roles, so account management could answer "who
-- else is HR". Both halves are asserted: HR gains every role row, and an
-- employee gains nothing — roles_read_own still bounds them to their own.
insert into res select 8, is((select count(*)::int from public.person_roles), 3,
  'HR reads every role row in its own org');

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
