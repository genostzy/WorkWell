-- Slice F's private tables, and the two deliberate exceptions to
-- "yours and nobody else's".
--
-- Assertions 3 and 4 are the interesting ones. Appreciation and support
-- requests are the only rows on the private plane another person can read,
-- and in both cases it is because the owner chose to send it. Everything
-- else stays shut, and the check-in guarantee is unchanged.
begin;
select plan(8);

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
  ('e3000000-0000-0000-0000-00000000000b', 'hr');
insert into private.check_ins (person_id, day, mood)
  values ('e3000000-0000-0000-0000-00000000000a', current_date, 2);

set local role authenticated;
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-00000000000a"}';

insert into private.nudge_prefs (person_id, move)
  values ('e3000000-0000-0000-0000-00000000000a', true);
insert into private.boundaries (person_id)
  values ('e3000000-0000-0000-0000-00000000000a');
insert into private.workspace_prefs (person_id, contrast)
  values ('e3000000-0000-0000-0000-00000000000a', 'high');
insert into private.appreciations (from_person, to_person, message)
  values ('e3000000-0000-0000-0000-00000000000a',
          'e3000000-0000-0000-0000-00000000000b', 'Thanks for covering the review.');
insert into private.support_requests (person_id, body, route)
  values ('e3000000-0000-0000-0000-00000000000a', 'Workload has been heavy.', 'hr');
insert into private.support_requests (person_id, body, route)
  values ('e3000000-0000-0000-0000-00000000000a', 'Rather talk to someone outside.', 'eap');

insert into res select 1, is((select count(*)::int from private.nudge_prefs), 1,
  'the employee reads their own nudge preferences');

-- Now as HR, in the same organisation.
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-00000000000b"}';

insert into res select 2, is(
  (select count(*)::int from private.nudge_prefs)
  + (select count(*)::int from private.boundaries)
  + (select count(*)::int from private.workspace_prefs), 0,
  'HR reads nothing of another person''s nudges, boundaries or workspace');

insert into res select 3, is((select count(*)::int from private.appreciations), 1,
  'HR reads appreciation addressed to them, because the sender chose to send it');

insert into res select 4, is((select count(*)::int from private.support_requests), 1,
  'HR reads the support request routed to HR');

insert into res select 5, is(
  (select count(*)::int from private.support_requests where route = 'eap'), 0,
  'a request routed to the EAP is never visible to HR');

insert into res select 6, is((select count(*)::int from private.check_ins), 0,
  'HR still reads zero check-ins');

-- Withdrawal must actually take it back.
set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-00000000000a"}';
update private.support_requests set status = 'withdrawn', withdrawn_at = now()
 where route = 'hr';

set local request.jwt.claims = '{"sub":"e2000000-0000-0000-0000-00000000000b"}';
insert into res select 7, is((select count(*)::int from private.support_requests), 0,
  'withdrawing a request removes it from HR');

-- And HR cannot write on someone else's behalf.
insert into res select 8, throws_ok(
  $$ insert into private.nudge_prefs (person_id, move)
     values ('e3000000-0000-0000-0000-00000000000a', false) $$,
  '42501', null,
  'HR cannot write another person''s private settings');

reset role;

select count(*) as total,
       count(*) filter (where r like 'not ok%') as failures,
       coalesce(string_agg(r, ' | ' order by i) filter (where r like 'not ok%'), 'ALL PASS') as detail
from res;
rollback;
