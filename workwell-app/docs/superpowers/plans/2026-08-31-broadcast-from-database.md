# Broadcast from Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Postgres Changes with Broadcast from Database for the four
realtime-subscribed tables, so live updates no longer depend on Realtime's
`postgres_changes` path correctly authenticating the subscriber's JWT.

**Architecture:** An `AFTER INSERT OR UPDATE OR DELETE` trigger on each of
the four tables calls `realtime.broadcast_changes()` to write a row into
`realtime.messages` under a topic name that encodes who the change belongs
to (e.g. `private-tasks:<person_id>`). A `select` RLS policy on
`realtime.messages` — written once per topic shape, re-using the same
`identity.*` helper functions each table's own RLS already calls — decides
who may join that topic. The client subscribes with
`.channel(topic, { config: { private: true } })` instead of a
`postgres_changes` filter. `work.assigned_tasks` has two audiences (the
employee, and HR org-wide), so its trigger broadcasts to two topics and gets
two read policies; the other three tables have one audience each.

**Tech Stack:** Supabase Postgres (migrations applied live via the Supabase
MCP `apply_migration`/`execute_sql` tools — this project has no local
Docker, so `supabase test db` is not available; see
`supabase/tests/README.md`), pgTAP for database tests, Next.js 16 +
`@supabase/supabase-js` 2.112.2 on the client.

**Spec:** No separate spec document — this plan's own Architecture section
and the exact `realtime.broadcast_changes()` / `realtime.send()` /
`realtime.topic()` function bodies pulled live from the project
(`oghphivmmqwqouyybwik`) via `pg_get_functiondef` are the source of truth.
Relevant prior art: `supabase/migrations/0064_realtime.sql` (the Postgres
Changes setup this replaces) and `src/lib/supabase/realtime.ts` (the
client-side wrapper this rewrites).

## Global Constraints

- Project id for every Supabase MCP call: `oghphivmmqwqouyybwik`.
- Migration files are hand-written, never `random()`-generated — this repo
  reruns the same migration file and expects the same result every time.
- Every DDL migration that touches a table PostgREST serves needs
  `notify pgrst, 'reload schema'` — not needed here (no new tables/views,
  only functions/triggers/policies on `realtime.messages`), so this
  migration omits it deliberately.
- Dry-run destructive SQL in a transaction and `rollback` before applying
  for real; this plan's own migration is additive (new functions, triggers,
  policies) plus one `alter publication ... drop table`, which is reversible
  by re-adding the tables to the publication, so no dry-run is required
  before `apply_migration`, but verify with `get_advisors` afterward.
- pgTAP test files each wrap themselves in `begin ... rollback` and are run
  by passing their full contents to the Supabase MCP `execute_sql` tool
  against the project above — not through a test runner.
- TypeScript changes are verified with `npm run typecheck`, `npm run lint`,
  `npm run test`, and `npm run build`, run with `--prefix workwell-app`
  from the repo root (`C:\Users\Wilson\OJT\Healthy You Workspace`).

---

## File Structure

- **Create:** `supabase/migrations/0067_broadcast_from_database.sql` — the
  four trigger functions, four triggers, five RLS policies on
  `realtime.messages`, and the removal of the four tables from the
  `supabase_realtime` publication.
- **Create:** `supabase/tests/14_broadcast_authorization.sql` — pgTAP
  coverage for all five policies, end-to-end (real row insert → real
  trigger fire → real policy evaluation).
- **Modify:** `src/lib/supabase/realtime.ts` — `watchTable(supabase, {schema,
  table, filter}, handlers)` becomes `watchTopic(supabase, topic, handlers)`.
- **Modify:** `src/components/notifications.tsx`,
  `src/app/tasks/tasks-client.tsx`, `src/app/tasks/assign-tasks-client.tsx`,
  `src/app/tasks/task-comments.tsx` — each swaps its `watchTable(...)` call(s)
  for `watchTopic(...)` with the matching topic string, and the two that
  don't already know their `person_id`/`org_id` at subscribe time
  (`notifications.tsx`, `assign-tasks-client.tsx`) gain a `public.me` read to
  learn it.

---

### Task 1: Broadcast triggers, RLS policies, and their pgTAP coverage

**Files:**
- Create: `supabase/migrations/0067_broadcast_from_database.sql`
- Create: `supabase/tests/14_broadcast_authorization.sql`

**Interfaces:**
- Produces: five topics later tasks subscribe to —
  `private-tasks:<person_id>`, `work-assigned-tasks:<person_id>`,
  `work-assigned-tasks-org:<org_id>`, `task-comments:<task_id>`,
  `notifications:<person_id>`.

- [ ] **Step 1: Write the pgTAP test file**

Create `supabase/tests/14_broadcast_authorization.sql`:

```sql
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

-- A second org, entirely local to this transaction, so the HR org-wide
-- policy has something outside Northwind to correctly deny.
insert into identity.orgs (id, name) values
  ('c0000000-0000-0000-0000-000000000001', 'Southridge (test-only)');

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-0000000000e1', 'celine.nolasco@northwind.example'),
  ('f0000000-0000-0000-0000-0000000000e2', 'wilson.dayrit@northwind.example');

update identity.people set auth_user_id = 'f0000000-0000-0000-0000-0000000000e1', status = 'active'
  where id = 'b0000000-0000-0000-0000-000000000001';
update identity.people set auth_user_id = 'f0000000-0000-0000-0000-0000000000e2', status = 'active'
  where id = 'b0000000-0000-0000-0000-000000000002';

-- A third person in the second org, for the cross-org denial cases. Nobody
-- signs in as them -- they only exist so assigned_tasks_broadcast() has
-- "the wrong org" to join through to.
insert into identity.people (id, org_id, email, full_name, status) values
  ('b0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000001',
   'someone@southridge.example', 'Someone Else', 'active');

-- private.tasks: Celine's own private task.
insert into private.tasks (id, person_id, title)
values ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Renew passport');

-- work.assigned_tasks: a task HR (Wilson) gave Celine (Northwind), and one
-- given to the Southridge person.
insert into work.assigned_tasks (id, person_id, title, assigned_by)
values
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Finish onboarding', 'b0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000009', 'Southridge task', null);

-- work.task_comments: on Celine's assigned task, from Celine.
insert into work.task_comments (id, task_id, author_id, body)
values ('d0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Blocked on IT');

-- work.notifications: to Celine.
insert into work.notifications (id, person_id, kind, title)
values ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'task_assigned', 'A task was assigned to you');

set local role authenticated;

-- 1. private.tasks -- Celine reads her own topic, Wilson does not.
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-0000000000e1"}';
set local realtime.topic = 'private-tasks:b0000000-0000-0000-0000-000000000001';
insert into res select 1, ok(exists(
  select 1 from realtime.messages
   where topic = 'private-tasks:b0000000-0000-0000-0000-000000000001'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000001'
), 'Celine sees the broadcast for her own private-tasks insert');

set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-0000000000e2"}';
insert into res select 2, ok(not exists(
  select 1 from realtime.messages
   where topic = 'private-tasks:b0000000-0000-0000-0000-000000000001'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000001'
), 'Wilson does not see a broadcast on Celine''s private-tasks topic');

-- 2a. work.assigned_tasks, own topic -- Celine reads her own assignment.
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-0000000000e1"}';
set local realtime.topic = 'work-assigned-tasks:b0000000-0000-0000-0000-000000000001';
insert into res select 3, ok(exists(
  select 1 from realtime.messages
   where topic = 'work-assigned-tasks:b0000000-0000-0000-0000-000000000001'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000002'
), 'Celine sees the broadcast on her own work-assigned-tasks topic');

set local realtime.topic = 'work-assigned-tasks:b0000000-0000-0000-0000-000000000009';
insert into res select 4, ok(not exists(
  select 1 from realtime.messages
   where topic = 'work-assigned-tasks:b0000000-0000-0000-0000-000000000009'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000003'
), 'Celine does not see the Southridge person''s own-assignment topic');

-- 2b. work.assigned_tasks, HR org-wide topic -- Wilson (HR, Northwind) sees
-- Northwind's org topic, not Southridge's; Celine (not HR) sees neither.
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-0000000000e2"}';
set local realtime.topic = 'work-assigned-tasks-org:a0000000-0000-0000-0000-000000000001';
insert into res select 5, ok(exists(
  select 1 from realtime.messages
   where topic = 'work-assigned-tasks-org:a0000000-0000-0000-0000-000000000001'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000002'
), 'HR sees the broadcast on their own org''s assigned-tasks-org topic');

set local realtime.topic = 'work-assigned-tasks-org:c0000000-0000-0000-0000-000000000001';
insert into res select 6, ok(not exists(
  select 1 from realtime.messages
   where topic = 'work-assigned-tasks-org:c0000000-0000-0000-0000-000000000001'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000003'
), 'HR does not see Southridge''s assigned-tasks-org topic');

set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-0000000000e1"}';
set local realtime.topic = 'work-assigned-tasks-org:a0000000-0000-0000-0000-000000000001';
insert into res select 7, ok(not exists(
  select 1 from realtime.messages
   where topic = 'work-assigned-tasks-org:a0000000-0000-0000-0000-000000000001'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000002'
), 'a non-HR employee does not see the org-wide assigned-tasks topic even for their own org');

-- 3. work.task_comments -- Celine (party to the task) and Wilson (HR, same
-- org, via the assigned_tasks join) both read the thread on d...0002;
-- neither reads a thread on the Southridge person's task.
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-0000000000e1"}';
set local realtime.topic = 'task-comments:d0000000-0000-0000-0000-000000000002';
insert into res select 8, ok(exists(
  select 1 from realtime.messages
   where topic = 'task-comments:d0000000-0000-0000-0000-000000000002'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000004'
), 'Celine sees the broadcast on her own task''s comment topic');

set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-0000000000e2"}';
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

-- 4. work.notifications -- Celine reads her own, Wilson does not.
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-0000000000e1"}';
set local realtime.topic = 'notifications:b0000000-0000-0000-0000-000000000001';
insert into res select 11, ok(exists(
  select 1 from realtime.messages
   where topic = 'notifications:b0000000-0000-0000-0000-000000000001'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000005'
), 'Celine sees the broadcast on her own notifications topic');

set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-0000000000e2"}';
insert into res select 12, ok(not exists(
  select 1 from realtime.messages
   where topic = 'notifications:b0000000-0000-0000-0000-000000000001'
     and payload->'record'->>'id' = 'd0000000-0000-0000-0000-000000000005'
), 'Wilson does not see a broadcast on Celine''s notifications topic');

reset role;

select count(*) as total,
       count(*) filter (where r like 'not ok%') as failures,
       coalesce(string_agg(r, ' | ' order by i) filter (where r like 'not ok%'), 'ALL PASS') as detail
from res;
rollback;
```

- [ ] **Step 2: Run the test to confirm it does not yet pass**

Run the file's full contents through the Supabase MCP `execute_sql` tool
against project `oghphivmmqwqouyybwik`.

Expected: the final summary row shows `failures` = 6, not 12 — the six
`ok(exists(...))` assertions (1, 3, 5, 8, 9, 11) fail because no trigger yet
writes anything into `realtime.messages`, so no row ever matches. The six
`ok(not exists(...))` assertions (2, 4, 6, 7, 10, 12) pass trivially, since
"no broadcast exists at all" also satisfies "the wrong person doesn't see
one." That six-failure state is this task's red.

- [ ] **Step 3: Write the migration file**

Create `supabase/migrations/0067_broadcast_from_database.sql`:

```sql
-- Replaces Postgres Changes (0064_realtime.sql) with Broadcast from
-- Database for the same four tables, so "who is this row for" is decided
-- again by ordinary RLS -- this time on realtime.messages -- rather than by
-- Realtime correctly authenticating a subscriber's JWT at the socket layer.
-- That layer has already failed silently once on this project: it signed
-- user JWTs with an asymmetric ES256 key that Realtime's postgres_changes
-- path did not verify, fell back to treating every socket as anon, and RLS
-- then correctly filtered out every row anon can't read -- no error, no
-- log, the channel still reported SUBSCRIBED, the screen just never
-- updated. Broadcast from the database still runs the identical
-- identity.* checks these tables' own RLS already uses, but it runs them
-- against realtime.messages the same way regardless of which key algorithm
-- signed the JWT -- there is no separate "did I authenticate this socket
-- right" step upstream of RLS for it to get wrong.
--
-- Shape, for all four tables: an AFTER trigger calls
-- realtime.broadcast_changes() to drop a row into realtime.messages under a
-- topic name that encodes who the change belongs to; a select policy on
-- realtime.messages decides who may read that topic, mirroring the same
-- table's own read policy. Nothing about what a client can ultimately see
-- changes -- same rows, same people, just authorized twice over rather than
-- inferred from Realtime's own auth handshake.
--
-- private.tasks and work.notifications are single-owner tables, so their
-- topic is just '<prefix>:<person_id>'. work.assigned_tasks has two
-- audiences reading two different scopes of the same table (the employee
-- reads their own rows, HR reads the whole org), so its trigger broadcasts
-- to two topics per change and gets two read policies. work.task_comments
-- has no person/org column of its own -- read access is decided by a join
-- through work.assigned_tasks, exactly as the table's own RLS (0058)
-- already does -- so its policy repeats that join, keyed off the task_id
-- embedded in the topic.

-- 1. private.tasks -- topic 'private-tasks:<person_id>'

create or replace function private.tasks_broadcast()
returns trigger
security definer
set search_path = ''
language plpgsql
as $$
begin
  perform realtime.broadcast_changes(
    'private-tasks:' || coalesce(new.person_id, old.person_id)::text,
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, new, old
  );
  return null;
end;
$$;

create trigger broadcast_tasks_changes
after insert or update or delete on private.tasks
for each row execute function private.tasks_broadcast();

create policy "authenticated can receive own private-tasks broadcasts"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and (select realtime.topic()) = 'private-tasks:' || identity.current_person_id()::text
);

-- 2. work.assigned_tasks -- topics 'work-assigned-tasks:<person_id>' (the
-- employee's own row) and 'work-assigned-tasks-org:<org_id>' (HR's
-- org-wide view). Both are broadcast on every change, since the two
-- audiences are reading two different scopes of the same event.

create or replace function work.assigned_tasks_broadcast()
returns trigger
security definer
set search_path = ''
language plpgsql
as $$
declare
  target_person uuid := coalesce(new.person_id, old.person_id);
  target_org uuid;
begin
  select org_id into target_org
    from identity.people
   where id = target_person;

  perform realtime.broadcast_changes(
    'work-assigned-tasks:' || target_person::text,
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, new, old
  );

  if target_org is not null then
    perform realtime.broadcast_changes(
      'work-assigned-tasks-org:' || target_org::text,
      TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, new, old
    );
  end if;

  return null;
end;
$$;

create trigger broadcast_assigned_tasks_changes
after insert or update or delete on work.assigned_tasks
for each row execute function work.assigned_tasks_broadcast();

create policy "authenticated can receive own assigned-task broadcasts"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and (select realtime.topic()) = 'work-assigned-tasks:' || identity.current_person_id()::text
);

create policy "hr can receive org assigned-task broadcasts"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and identity.is_hr()
  and (select realtime.topic()) = 'work-assigned-tasks-org:' || identity.current_org_id()::text
);

-- 3. work.task_comments -- topic 'task-comments:<task_id>'. No person/org
-- column on the table itself, so the read policy repeats the same join
-- through work.assigned_tasks that task_comments_read (0058) already does,
-- keyed off the task_id parsed back out of the topic.

create or replace function work.task_comments_broadcast()
returns trigger
security definer
set search_path = ''
language plpgsql
as $$
begin
  perform realtime.broadcast_changes(
    'task-comments:' || coalesce(new.task_id, old.task_id)::text,
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, new, old
  );
  return null;
end;
$$;

create trigger broadcast_task_comments_changes
after insert or update or delete on work.task_comments
for each row execute function work.task_comments_broadcast();

create policy "authenticated can receive task-comments broadcasts for their tasks"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and (select realtime.topic()) like 'task-comments:%'
  and exists (
    select 1
      from work.assigned_tasks t
     where t.id = split_part((select realtime.topic()), ':', 2)::uuid
       and (
         t.person_id = identity.current_person_id()
         or (identity.is_hr() and identity.same_org(t.person_id))
       )
  )
);

-- 4. work.notifications -- topic 'notifications:<person_id>'

create or replace function work.notifications_broadcast()
returns trigger
security definer
set search_path = ''
language plpgsql
as $$
begin
  perform realtime.broadcast_changes(
    'notifications:' || coalesce(new.person_id, old.person_id)::text,
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, new, old
  );
  return null;
end;
$$;

create trigger broadcast_notifications_changes
after insert or update or delete on work.notifications
for each row execute function work.notifications_broadcast();

create policy "authenticated can receive own notification broadcasts"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and (select realtime.topic()) = 'notifications:' || identity.current_person_id()::text
);

-- Postgres Changes is no longer how any of these four reach a client --
-- drop them back out of the publication that made that possible. Left in
-- place: each table's `replica identity full` from 0064. It cost nothing to
-- set, and Broadcast's triggers read NEW/OLD directly within the firing
-- transaction regardless of replica identity, so it is not doing anything
-- for these four any more -- but nothing depends on reverting it either,
-- and undoing it is not part of what this migration is for.
alter publication supabase_realtime drop table
  private.tasks,
  work.assigned_tasks,
  work.task_comments,
  work.notifications;
```

- [ ] **Step 4: Apply the migration**

Call the Supabase MCP `apply_migration` tool with `project_id:
"oghphivmmqwqouyybwik"`, `name: "broadcast_from_database"`, and `query` set
to the full SQL body from Step 3 (everything after the header comment block
is fine to include — comments are harmless in the applied migration and
keep the live history self-explanatory, matching every other migration on
this project).

Expected: applies cleanly. If it errors on `create policy` because a policy
with the same name already exists from an earlier partial attempt, drop
that policy first (`drop policy if exists "<name>" on realtime.messages;`)
and re-apply.

- [ ] **Step 5: Run the test again to confirm it passes**

Run `supabase/tests/14_broadcast_authorization.sql`'s full contents through
`execute_sql` against `oghphivmmqwqouyybwik`, exactly as in Step 2.

Expected: the summary row shows `total = 12`, `failures = 0`,
`detail = 'ALL PASS'`.

- [ ] **Step 6: Check advisors**

Call the Supabase MCP `get_advisors` tool with `project_id:
"oghphivmmqwqouyybwik"` and `type: "security"`.

Expected: no new finding referencing `realtime.messages` or the four new
trigger functions. (Pre-existing findings unrelated to this change are not
this task's concern.)

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0067_broadcast_from_database.sql supabase/tests/14_broadcast_authorization.sql
git commit -m "feat: broadcast task, comment, and notification changes from the database"
```

---

### Task 2: Rewrite the client-side realtime helper

**Files:**
- Modify: `src/lib/supabase/realtime.ts`

**Interfaces:**
- Consumes: `SupabaseClient` from `@supabase/supabase-js` (unchanged
  dependency).
- Produces: `watchTopic<T extends Record<string, unknown>>(supabase:
  SupabaseClient, topic: string, handlers: { onInsert?: (row: T) => void;
  onUpdate?: (row: T) => void; onDelete?: (row: T) => void }): () => void`
  — replaces the old `watchTable(supabase, {schema, table, filter?},
  handlers)`. Tasks 3–6 import this.

- [ ] **Step 1: Replace the file contents**

Replace all of `src/lib/supabase/realtime.ts` with:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

type ChangeHandlers<T> = {
  onInsert?: (row: T) => void
  onUpdate?: (row: T) => void
  onDelete?: (row: T) => void
}

type BroadcastEnvelope<T> = {
  payload: {
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
    table: string
    schema: string
    record: T | null
    old_record: T | null
  }
}

/**
 * Subscribe to a Broadcast-from-Database topic and get back a function that
 * tears the subscription down.
 *
 * `topic` names a private channel authorized by an RLS policy on
 * realtime.messages, set up by whichever migration wired the trigger that
 * broadcasts to it -- see 0067_broadcast_from_database.sql for the five
 * topics currently live (private-tasks:<person_id>,
 * work-assigned-tasks:<person_id>, work-assigned-tasks-org:<org_id>,
 * task-comments:<task_id>, notifications:<person_id>). There is nothing to
 * authorize here beyond joining the right topic string -- the RLS policy on
 * realtime.messages is where "who is this for" is actually decided, same as
 * it always was for the table itself.
 *
 * Unauthorized here does not look like an errored payload the way it did
 * under Postgres Changes: a client without a matching realtime.messages
 * policy simply never receives anything on that topic at all. There is no
 * `errors` field to check and no empty-row shape to guard against.
 */
export function watchTopic<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  topic: string,
  handlers: ChangeHandlers<T>
) {
  let channel: ReturnType<SupabaseClient['channel']> | null = null
  let cancelled = false

  // Same reasoning as the Postgres Changes version this replaces: the
  // socket is told who is watching before the channel joins, rather than
  // relying on supabase-js's own realtime.setAuth() on SIGNED_IN /
  // TOKEN_REFRESHED, which fires on auth *transitions* and loses the race
  // against a page loaded with a session already in cookies. Broadcast's
  // authorization is checked at join time (and re-checked whenever a fresh
  // JWT arrives), so a socket that joins unauthenticated stays unauthorized
  // for the life of the connection.
  ;(async () => {
    const { data } = await supabase.auth.getSession()
    if (cancelled) return
    await supabase.realtime.setAuth(data.session?.access_token ?? null)
    if (cancelled) return

    channel = buildChannel()
  })()

  function buildChannel() {
    return supabase
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, (msg) => {
        const record = (msg as BroadcastEnvelope<T>).payload.record
        if (record) handlers.onInsert?.(record)
      })
      .on('broadcast', { event: 'UPDATE' }, (msg) => {
        const record = (msg as BroadcastEnvelope<T>).payload.record
        if (record) handlers.onUpdate?.(record)
      })
      .on('broadcast', { event: 'DELETE' }, (msg) => {
        const oldRecord = (msg as BroadcastEnvelope<T>).payload.old_record
        if (oldRecord) handlers.onDelete?.(oldRecord)
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime subscription to topic "${topic}" failed (${status})`, err)
        }
      })
  }

  return () => {
    cancelled = true
    if (channel) supabase.removeChannel(channel)
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck --prefix workwell-app
```

Expected: fails here — Tasks 3–6 haven't updated their imports yet, so
`watchTable` is now undefined in four files. That is expected at this point
in the plan; each of those files gets fixed in its own task.

- [ ] **Step 3: Commit**

```bash
git add "workwell-app/src/lib/supabase/realtime.ts"
git commit -m "refactor: rebuild the realtime helper around Broadcast topics instead of Postgres Changes filters"
```

---

### Task 3: `notifications.tsx` — subscribe by person_id topic

**Files:**
- Modify: `src/components/notifications.tsx`

**Interfaces:**
- Consumes: `watchTopic` from `src/lib/supabase/realtime.ts` (Task 2).

- [ ] **Step 1: Fetch the current person_id and subscribe on its topic**

In `src/components/notifications.tsx`, change the import on line 7:

```ts
import { watchTopic } from '@/lib/supabase/realtime'
```

Replace the effect at lines 87–134 (the one that fetches notifications and
subscribes) with:

```ts
  useEffect(() => {
    let cancelled = false
    let stop: (() => void) | null = null

    ;(async () => {
      const supabase = createClient()
      const [{ data: me }, { data }] = await Promise.all([
        supabase.from('me').select('id').maybeSingle(),
        supabase
          .from('notifications')
          .select('id, kind, title, body, link, read, created_at')
          .eq('read', false)
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      setNotifications(data ?? [])

      const personId = me?.id
      if (!personId) return

      stop = watchTopic<Notification>(supabase, `notifications:${personId}`, {
        onInsert: (n) => {
          if (n.read) return
          setNotifications((prev) =>
            prev.some((x) => x.id === n.id)
              ? prev
              : [n, ...prev].sort(
                  (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
                )
          )

          // Toasts are for the moment something arrives, not for what was
          // already sitting unread when the page loaded -- that is what the
          // bell and its badge are for. This only ever runs from the
          // subscription, never from the initial fetch above, so a page
          // opened with five unread notifications shows five in the bell
          // and zero toasts.
          setToasts((t) => [...t, n])
          const timer = setTimeout(() => dismissToast(n.id), TOAST_MS)
          timers.current.set(n.id, timer)
        },
        // The only update a notification ever gets is being marked read
        // (see 0046's guard trigger), so an update either drops it from
        // this unread-only list or is a no-op echo of a change this tab
        // already made itself.
        onUpdate: (n) => {
          setNotifications((prev) =>
            n.read ? prev.filter((x) => x.id !== n.id) : prev
          )
        },
      })
    })()

    return () => {
      cancelled = true
      stop?.()
    }
  }, [dismissToast])
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck --prefix workwell-app
```

Expected: no errors referencing `notifications.tsx` (errors in the three
files not yet updated are still expected until their own tasks land).

- [ ] **Step 3: Commit**

```bash
git add "workwell-app/src/components/notifications.tsx"
git commit -m "refactor: subscribe notifications by broadcast topic instead of a Postgres Changes filter"
```

---

### Task 4: `tasks-client.tsx` — two per-person topics

**Files:**
- Modify: `src/app/tasks/tasks-client.tsx`

**Interfaces:**
- Consumes: `watchTopic` from `src/lib/supabase/realtime.ts` (Task 2).

- [ ] **Step 1: Swap both watchTable calls for watchTopic**

Change the import on line 5:

```ts
import { watchTopic } from '@/lib/supabase/realtime'
```

Replace the effect at lines 150–179 with:

```ts
  // Both lists filtered to this person: private.tasks is nobody else's to
  // begin with, and work.assigned_tasks is filtered the same way this
  // screen's own select already is, rather than relying on RLS alone to
  // narrow a busier table this account has no other reason to hear about.
  // Waits for personId, since that is what each topic is built from.
  useEffect(() => {
    if (!personId) return
    const supabase = createClient()

    const stopMine = watchTopic<Task>(supabase, `private-tasks:${personId}`, {
      onInsert: (row) => setMine((t) => upsert(t, toTask(row))),
      onUpdate: (row) => setMine((t) => upsert(t, toTask(row))),
      onDelete: (row) => setMine((t) => t.filter((x) => x.id !== row.id)),
    })

    const stopAssigned = watchTopic<Task>(supabase, `work-assigned-tasks:${personId}`, {
      onInsert: (row) => setAssigned((t) => upsert(t, toTask(row))),
      onUpdate: (row) => setAssigned((t) => upsert(t, toTask(row))),
      onDelete: (row) => setAssigned((t) => t.filter((x) => x.id !== row.id)),
    })

    return () => {
      stopMine()
      stopAssigned()
    }
  }, [personId])
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck --prefix workwell-app
```

Expected: no errors referencing `tasks-client.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "workwell-app/src/app/tasks/tasks-client.tsx"
git commit -m "refactor: subscribe the tasks screen by broadcast topic instead of a Postgres Changes filter"
```

---

### Task 5: `assign-tasks-client.tsx` — org-wide topic

**Files:**
- Modify: `src/app/tasks/assign-tasks-client.tsx`

**Interfaces:**
- Consumes: `watchTopic` from `src/lib/supabase/realtime.ts` (Task 2).

- [ ] **Step 1: Fetch org_id alongside id, and subscribe on the org topic**

Change the import on line 5:

```ts
import { watchTopic } from '@/lib/supabase/realtime'
```

Add an `orgId` state next to `meId` (after line 52):

```ts
  const [meId, setMeId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
```

In the load effect (lines 67–93), change the `me` select and the line that
reads its result:

```ts
        supabase.from('me').select('id, org_id').maybeSingle(),
```

```ts
        setMeId(me.data?.id ?? null)
        setOrgId(me.data?.org_id ?? null)
```

Replace the subscription effect at lines 100–114 with:

```ts
  // The org-wide topic: HR's own read policy already covers every task in
  // the org, so the same is true of what this topic's RLS policy will let
  // through, and there is no narrower scope for this screen to ask for.
  // Ticking a task off from the employee's side, or a second HR tab
  // assigning or removing one, shows up here without a reload. Waits for
  // orgId, since that is what the topic is built from.
  useEffect(() => {
    if (!orgId) return
    const supabase = createClient()

    return watchTopic<Assigned>(supabase, `work-assigned-tasks-org:${orgId}`, {
      onInsert: (row) =>
        setRows((r) => (r.some((x) => x.id === row.id) ? r : [toAssigned(row), ...r])),
      onUpdate: (row) =>
        setRows((r) => r.map((x) => (x.id === row.id ? toAssigned(row) : x))),
      onDelete: (row) => setRows((r) => r.filter((x) => x.id !== row.id)),
    })
  }, [orgId])
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck --prefix workwell-app
```

Expected: no errors referencing `assign-tasks-client.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "workwell-app/src/app/tasks/assign-tasks-client.tsx"
git commit -m "refactor: subscribe HR's task board by org-wide broadcast topic instead of an unfiltered Postgres Changes subscription"
```

---

### Task 6: `task-comments.tsx` — per-task topic

**Files:**
- Modify: `src/app/tasks/task-comments.tsx`

**Interfaces:**
- Consumes: `watchTopic` from `src/lib/supabase/realtime.ts` (Task 2).

- [ ] **Step 1: Swap the watchTable call for watchTopic**

Change the import on line 5:

```ts
import { watchTopic } from '@/lib/supabase/realtime'
```

Replace the effect at lines 68–84 with:

```ts
  // A thread nobody has opened has no reason to hold a socket open for it
  // -- kept on its own effect, keyed only on `open` and `taskId`, so a new
  // comment arriving (which changes `comments` above) does not tear this
  // down and resubscribe on every message.
  useEffect(() => {
    if (!open) return
    const supabase = createClient()

    return watchTopic<Comment>(supabase, `task-comments:${taskId}`, {
      onInsert: (c) =>
        setComments((prev) =>
          prev && !prev.some((x) => x.id === c.id) ? [...prev, c] : prev
        ),
      onDelete: (c) =>
        setComments((prev) => prev && prev.filter((x) => x.id !== c.id)),
    })
  }, [open, taskId])
```

- [ ] **Step 2: Typecheck, lint, unit tests**

```bash
npm run typecheck --prefix workwell-app
npm run lint --prefix workwell-app
npm run test --prefix workwell-app
```

Expected: all three pass clean — this is the last of the four consumers, so
typecheck should now be fully green across the project (0 errors, matching
the pre-existing 16 warnings noted in the last handoff), lint clean, and all
52+ tests passing.

- [ ] **Step 3: Commit**

```bash
git add "workwell-app/src/app/tasks/task-comments.tsx"
git commit -m "refactor: subscribe task comment threads by broadcast topic instead of a Postgres Changes filter"
```

---

### Task 7: Build, and live verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Production build**

```bash
npm run build --prefix workwell-app
```

Expected: builds clean.

- [ ] **Step 2: Live check — notification delivery**

Using the same technique the last session used (a throwaway page under
`src/app/sign-in/<name>/` that signs a test account in programmatically,
since typing a password into the real sign-in form is off the table — see
the handoff's "How testing was done" section), sign in as one employee
account in the Browser pane, then use the Supabase MCP `execute_sql` tool
to insert a row into `work.notifications` for that person's `id` (found via
`select id from identity.people where email = '<their email>'`). Confirm in
the browser: the bell's unread count increments and a toast appears with
the right title/body, without a page reload. Delete the throwaway sign-in
page afterward, and check `.next` for any leftover build artifact or
sourcemap referencing it (the same leak this repo's handoff already
documents once).

- [ ] **Step 3: Live check — the other three flows**

Still signed in, exercise:
- **Own tasks** (`private-tasks:<id>`): add a task on `/tasks`, confirm it
  appears without reload; in a second tab or via `execute_sql`, update its
  `done_at`, confirm the first tab reflects it live.
- **Assigned tasks, employee side** (`work-assigned-tasks:<id>`): from a
  second session signed in as HR (or via `execute_sql` inserting into
  `work.assigned_tasks` for this person), assign a task; confirm it appears
  on `/tasks` "Given to you" live.
- **Assigned tasks, HR side** (`work-assigned-tasks-org:<org_id>`): sign in
  as HR, open `/tasks` (the assign screen), and from the employee side (or
  via `execute_sql`) tick a task done; confirm HR's table updates live.
- **Task comments** (`task-comments:<task_id>`): open a task's thread on
  both the employee and HR views (or one view plus `execute_sql` inserting
  into `work.task_comments`), confirm a posted comment appears on the other
  side live.

Expected: all four update without a page reload, and the browser console
shows no `Realtime subscription to topic "..." failed` errors (from the
`console.error` in `watchTopic`).

- [ ] **Step 4: Final commit**

If Steps 2–3 required no code changes, there is nothing left to commit —
this task is verification-only. If a live check surfaced a bug, fix it,
re-run the relevant typecheck/lint/test commands from that file's own task,
and commit the fix with a message describing what was wrong.
