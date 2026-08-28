-- Comments on an assigned task.
--
-- A task somebody was given is the one kind here that can be blocked by
-- something the person doing it cannot fix — a missing key, a locked
-- account, an answer they are waiting on. Until now the only reply
-- available was ticking it or not ticking it.
--
-- Assigned tasks only, deliberately. private.tasks is a list you keep for
-- yourself; there is nobody on the other end of it to comment to, and
-- giving it a comment thread would imply there was.

create table work.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references work.assigned_tasks(id) on delete cascade,
  author_id  uuid not null references identity.people(id) on delete cascade,
  body       text not null check (btrim(body) <> ''),
  created_at timestamptz not null default now()
);

create index task_comments_task_idx on work.task_comments (task_id, created_at);

alter table work.task_comments enable row level security;

-- Readable by exactly the people who can already read the task itself.
-- Written as a lookup against work.assigned_tasks rather than restating
-- that table's rule, so the two cannot drift apart: widen or narrow who
-- may see a task and this follows on its own.
create policy task_comments_read on work.task_comments
  for select to authenticated
  using (
    exists (
      select 1 from work.assigned_tasks t
       where t.id = task_id
         and (
           t.person_id = identity.current_person_id()
           or (identity.is_hr() and identity.same_org(t.person_id))
         )
    )
  );

-- You may only post as yourself, and only on a task you are part of.
-- author_id is checked against the caller rather than trusted from the
-- insert: without that, anyone able to comment could sign somebody else's
-- name to it.
create policy task_comments_write on work.task_comments
  for insert to authenticated
  with check (
    author_id = identity.current_person_id()
    and exists (
      select 1 from work.assigned_tasks t
       where t.id = task_id
         and (
           t.person_id = identity.current_person_id()
           or (identity.is_hr() and identity.same_org(t.person_id))
         )
    )
  );

-- Your own words are yours to take back. Nobody edits anybody's comment,
-- including their own: an edited record of a blocker is worth less than an
-- honest one, and a deleted one at least reads as deleted.
create policy task_comments_delete on work.task_comments
  for delete to authenticated
  using (author_id = identity.current_person_id());

grant select, insert, delete on work.task_comments to authenticated;
revoke update, truncate, references, trigger
  on work.task_comments from authenticated, anon;

create view public.task_comments with (security_invoker = true) as
  select id, task_id, author_id, body, created_at
    from work.task_comments;

grant select, insert, delete on public.task_comments to authenticated;

notify pgrst, 'reload schema';
