-- End-to-end check for the Broadcast-from-Database migration
-- (0067_broadcast_from_database.sql): for each of the five realtime.messages
-- read policies, a real row change is made on the source table (as
-- postgres, bypassing that table's own RLS the way a trigger always does),
-- and the resulting realtime.messages row is queried as an authenticated
-- subscriber -- once with the JWT and topic that should see it, once with
-- one that should not.
--
-- Deliberately end-to-end rather than a direct check of pg_policies: what
-- has to be right is the whole path (trigger fires -> broadcast_changes
-- computes the right topic -> the read policy recognizes that topic for the
-- right subscriber), and a unit-level check of the policy expression alone
-- would not catch a topic string the trigger and the policy disagree about.
--
-- Assertions match by the source row's own id, nested inside the broadcast
-- payload (payload->'record'->>'id' or payload->'old_record'->>'id'), not
-- by counting rows on a topic. realtime.messages is a real table with a
-- 3-day retention window on a project other sessions use live -- counting
-- would be flaky against traffic this test did not create.
begin;
select plan(12);

create temp table res(i int, r text) on commit drop;
grant all on res to authenticated;

-- Fully self-contained fixture -- a fresh org and two fresh people (an
-- employee and HR), not a reuse of any pre-existing seed row. An earlier
-- version of this test reused the demo seed's 'b0000000-...0001'/'...0002'
-- people (Celine/Wilson), matching 12_planes.sql's convention -- but
-- 0060_real_people.sql deletes those rows on the live project, replacing
-- them with different UUIDs, so that convention no longer holds. This
-- follows 13_slice_f.sql's newer pattern instead: everything the test
-- needs is created and torn down inside its own transaction, with no
-- dependency on what any seed migration currently happens to contain.
insert into identity.orgs (id, name) values
  ('a1000000-0000-0000-0000-00000000000a', 'Northwind (test-only)'),
  ('c0000000-0000-0000-0000-000000000001', 'Southridge (test-only)');

insert into auth.users (id, email) values
  ('a2000000-0000-0000-0000-00000000000a', 'employee@northwind-test.example'),
  ('a2000000-0000-0000-0000-00000000000b', 'hr@northwind-test.example');

insert into identity.people (id, org_id, auth_user_id, email, full_name, status) values
  ('a3000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-00000000000a',
   'a2000000-0000-0000-0000-00000000000a', 'employee@northwind-test.example', 'The Employee', 'active'),
  ('a3000000-0000-0000-0000-00000000000b', 'a1000000-0000-0000-0000-00000000000a',
   'a2000000-0000-0000-0000-00000000000b', 'hr@northwind-test.example', 'The HR Lead', 'active');

insert into identity.person_roles (person_id, role) values
  ('a3000000-0000-0000-0000-00000000000a', 'employee'),
  ('a3000000-0000-0000-0000-00000000000b', 'employee'),
  ('a3000000-0000-0000-0000-00000000000b', 'hr');

-- A third person in the second org, for the cross-org denial cases. Nobody
-- signs in as them -- they only exist so assigned_tasks_broadcast() has
-- "the wrong org" to join through to.
insert into identity.people (id, org_id, email, full_name, status) values
  ('b0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000001',
   'someone@southridge.example', 'Someone Else', 'active');

-- private.tasks: the employee's own private task.
insert into private.tasks (id, person_id, title)
values ('d0000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-00000000000a', 'Renew passport');

-- work.assigned_tasks: a task HR gave the employee (Northwind), and one
-- given to the Southridge person.
insert into work.assigned_tasks (id, person_id, title, assigned_by)
values
  ('d0000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-00000000000a', 'Finish onboarding', 'a3000000-0000-0000-0000-00000000000b'),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000009', 'Southridge task', null);

-- work.task_comments: on the employee's assigned task, from the employee.
insert into work.task_comments (id, task_id, author_id, body)
values ('d0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-00000000000a', 'Blocked on IT');

-- work.notifications: to the employee.
insert into work.notifications (id, person_id, kind, title)
values ('d0000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-00000000000a', 'task_assigned', 'A task was assigned to you');

set local role authenticated;

-- 1. private.tasks -- the employee reads their own topic, HR does not.
set local request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-00000000000a"}';
set local realtime.topic = 'private-tasks:a3000000-0000-0000-0000-00000000000a';
insert into res select 1, ok(exists(
  select 1 from realtime.messages
   where topic = 'private-tasks:a3000000-0000-0000-0000-00000000000a'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000001'
), 'the employee sees the broadcast for their own private-tasks insert');

set local request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-00000000000b"}';
insert into res select 2, ok(not exists(
  select 1 from realtime.messages
   where topic = 'private-tasks:a3000000-0000-0000-0000-00000000000a'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000001'
), 'HR does not see a broadcast on the employee''s private-tasks topic');

-- 2a. work.assigned_tasks, own topic -- the employee reads their own assignment.
set local request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-00000000000a"}';
set local realtime.topic = 'work-assigned-tasks:a3000000-0000-0000-0000-00000000000a';
insert into res select 3, ok(exists(
  select 1 from realtime.messages
   where topic = 'work-assigned-tasks:a3000000-0000-0000-0000-00000000000a'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000002'
), 'the employee sees the broadcast on their own work-assigned-tasks topic');

set local realtime.topic = 'work-assigned-tasks:b0000000-0000-0000-0000-000000000009';
insert into res select 4, ok(not exists(
  select 1 from realtime.messages
   where topic = 'work-assigned-tasks:b0000000-0000-0000-0000-000000000009'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000003'
), 'the employee does not see the Southridge person''s own-assignment topic');

-- 2b. work.assigned_tasks, HR org-wide topic -- HR (Northwind) sees
-- Northwind's org topic, not Southridge's; the employee (not HR) sees neither.
set local request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-00000000000b"}';
set local realtime.topic = 'work-assigned-tasks-org:a1000000-0000-0000-0000-00000000000a';
insert into res select 5, ok(exists(
  select 1 from realtime.messages
   where topic = 'work-assigned-tasks-org:a1000000-0000-0000-0000-00000000000a'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000002'
), 'HR sees the broadcast on their own org''s assigned-tasks-org topic');

set local realtime.topic = 'work-assigned-tasks-org:c0000000-0000-0000-0000-000000000001';
insert into res select 6, ok(not exists(
  select 1 from realtime.messages
   where topic = 'work-assigned-tasks-org:c0000000-0000-0000-0000-000000000001'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000003'
), 'HR does not see Southridge''s assigned-tasks-org topic');

set local request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-00000000000a"}';
set local realtime.topic = 'work-assigned-tasks-org:a1000000-0000-0000-0000-00000000000a';
insert into res select 7, ok(not exists(
  select 1 from realtime.messages
   where topic = 'work-assigned-tasks-org:a1000000-0000-0000-0000-00000000000a'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000002'
), 'a non-HR employee does not see the org-wide assigned-tasks topic even for their own org');

-- 3. work.task_comments -- the employee (party to the task) and HR (same
-- org, via the assigned_tasks join) both read the thread on d...0002;
-- neither reads a thread on the Southridge person's task.
set local request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-00000000000a"}';
set local realtime.topic = 'task-comments:d0000000-0000-0000-0000-000000000002';
insert into res select 8, ok(exists(
  select 1 from realtime.messages
   where topic = 'task-comments:d0000000-0000-0000-0000-000000000002'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000004'
), 'the employee sees the broadcast on their own task''s comment topic');

set local request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-00000000000b"}';
insert into res select 9, ok(exists(
  select 1 from realtime.messages
   where topic = 'task-comments:d0000000-0000-0000-0000-000000000002'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000004'
), 'HR (same org) also sees it, via the assigned_tasks join the policy repeats from 0058');

set local realtime.topic = 'task-comments:d0000000-0000-0000-0000-000000000003';
insert into res select 10, ok(not exists(
  select 1 from realtime.messages
   where topic = 'task-comments:d0000000-0000-0000-0000-000000000003'
), 'nobody has a comment topic for the Southridge person''s task in this test (none posted), and the policy does not error on an empty join');

-- 4. work.notifications -- the employee reads their own, HR does not.
set local request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-00000000000a"}';
set local realtime.topic = 'notifications:a3000000-0000-0000-0000-00000000000a';
insert into res select 11, ok(exists(
  select 1 from realtime.messages
   where topic = 'notifications:a3000000-0000-0000-0000-00000000000a'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000005'
), 'the employee sees the broadcast on their own notifications topic');

set local request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-00000000000b"}';
insert into res select 12, ok(not exists(
  select 1 from realtime.messages
   where topic = 'notifications:a3000000-0000-0000-0000-00000000000a'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000005'
), 'HR does not see a broadcast on the employee''s notifications topic');

reset role;

select count(*) as total,
       count(*) filter (where r like 'not ok%') as failures,
       coalesce(string_agg(r, ' | ' order by i) filter (where r like 'not ok%'), 'ALL PASS') as detail
from res;
rollback;
