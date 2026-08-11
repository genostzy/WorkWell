-- The whole two-plane model, asserted from both sides at once.
--
-- Note assertion 7's shape. An earlier draft asserted HR reads zero
-- check-ins full stop, and it failed — correctly. Wilson holds `employee`
-- as well as `hr`, so he has his own wellbeing data and must be able to
-- read it. The guarantee is not "HR reads no check-ins", it is "HR reads
-- nobody else's". Getting that wrong in a test would have pushed us to
-- break a deliberate design decision to make a bad assertion pass.
begin;
select plan(8);

create temp table res(i int, r text) on commit drop;
grant all on res to authenticated;

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-0000000000e1', 'celine.nolasco@northwind.example'),
  ('f0000000-0000-0000-0000-0000000000e2', 'wilson.dayrit@northwind.example');

update identity.people set auth_user_id = 'f0000000-0000-0000-0000-0000000000e1', status = 'active'
  where id = 'b0000000-0000-0000-0000-000000000001';
update identity.people set auth_user_id = 'f0000000-0000-0000-0000-0000000000e2', status = 'active'
  where id = 'b0000000-0000-0000-0000-000000000002';

set local role authenticated;

-- The employee. No org plane at all.
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-0000000000e1"}';
insert into res select 1, is((select count(*)::int from public.org_cohorts), 0,
  'an employee sees no cohorts');
insert into res select 2, is((select count(*)::int from public.org_metrics), 0,
  'an employee sees no org metrics');
insert into res select 3, is((select count(*)::int from public.employment
  where person_id <> identity.current_person_id()), 0,
  'an employee reads only their own employment row');

-- HR. Cohorts yes, individuals no.
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-0000000000e2"}';
insert into res select 4, ok((select count(*)::int from public.org_cohorts) >= 4,
  'HR sees every cohort, including the suppressed ones by name');
insert into res select 5, is((select count(distinct cohort)::int from public.org_metrics), 1,
  'HR sees metrics for exactly the one cohort that clears the threshold');
insert into res select 6, is((select count(*)::int from public.org_metrics
  where cohort <> 'Engineering'), 0,
  'no metric row exists for a suppressed cohort');
insert into res select 7, is((select count(*)::int from public.check_ins
  where person_id <> identity.current_person_id()), 0,
  'HR reads zero check-ins belonging to anyone else');
insert into res select 8, ok((select count(*)::int from public.employment) > 10,
  'HR does read the whole org employment directory');

reset role;

select count(*) as total,
       count(*) filter (where r like 'not ok%') as failures,
       coalesce(string_agg(r, ' | ' order by i) filter (where r like 'not ok%'), 'ALL PASS') as detail
from res;
rollback;
