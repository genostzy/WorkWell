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
