-- A second real, signed-in-able account, purely for testing cross-account
-- behaviour (realtime, notifications, task assignment) without touching
-- Celine's.
--
-- Only one side of this is here: identity.people, the employee role, and
-- an employment record. The auth.users row itself was provisioned through
-- Supabase's Admin API (POST /auth/v1/admin/users with the service role
-- key), not SQL -- inserting directly into auth.users to fabricate a
-- working password hash and identity record is unsupported and the kind
-- of thing a future Supabase Auth upgrade silently breaks. This file
-- documents the link, not the account; recreating it elsewhere means
-- provisioning the auth user the same way first and substituting its id
-- below.
--
-- No test HR account alongside it: identity.enforce_single_hr() (0026)
-- hard-blocks a second 'hr' row per org with "this organisation already
-- has an HR account", by design, not by oversight. Big Boss is the HR
-- side of every test from here on.

insert into identity.people (id, org_id, auth_user_id, email, full_name, status)
values (
  'a33ede7c-96b2-456c-b3b4-9c79a9ddca54',
  'a0000000-0000-0000-0000-000000000001',
  '3d44a50f-56d8-430b-9dc6-5ec71ae7a5f3',  -- auth.users id from the Admin API call
  'test.employee@workwell.com',
  'Test Employee',
  'active'
)
on conflict (id) do nothing;

insert into identity.person_roles (person_id, role)
values ('a33ede7c-96b2-456c-b3b4-9c79a9ddca54', 'employee')
on conflict do nothing;

insert into work.employment
  (person_id, job_title, department, team, manager_id, contract_type, location, started_on, entitlement)
values (
  'a33ede7c-96b2-456c-b3b4-9c79a9ddca54', 'QA Tester', 'Engineering', 'Quality',
  'e0000000-0000-0000-0000-000000000003',  -- Marlon Velasquez, Engineering lead
  'Contract', 'Manila', current_date, 10
)
on conflict (person_id) do nothing;
