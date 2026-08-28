-- Tasks, on both planes, kept structurally apart.
--
-- Two tables rather than one with a flag, because they are not the same
-- kind of thing and the difference is the product: a task you set yourself
-- is private-plane and nobody — HR included — may ever read it, while a
-- task HR gives you is work-plane and employer-visible by definition. One
-- table with an `is_private` column would put both under a single set of
-- policies, and the only thing standing between HR and somebody's private
-- list would be a predicate somebody could later get wrong. Two tables in
-- two schemas cannot be got wrong that way: there is no policy anywhere
-- granting HR reach into private.tasks, so there is nothing to misread.
--
-- Same reason the rest of the private plane is laid out this way. See
-- 0017's note: person_id = current_person_id() for every verb.

-- ------------------------------------------------------- Your own list

create table private.tasks (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references identity.people(id) on delete cascade,
  title      text not null check (btrim(title) <> ''),
  note       text,
  due_on     date,
  -- A timestamp rather than a boolean: "done" and "done at 4pm on Tuesday"
  -- cost the same to store, and only one of them can be reported on later.
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

-- The list's own order: unfinished first, then by when they are due. Nulls
-- first on done_at is what puts the open ones at the top, and matching the
-- index to the sort the screen actually asks for keeps it a scan of the
-- rows it wants rather than of every task the person has ever written.
create index tasks_person_idx
  on private.tasks (person_id, done_at nulls first, due_on nulls last);

alter table private.tasks enable row level security;

create policy tasks_own on private.tasks
  for all to authenticated
  using (person_id = identity.current_person_id())
  with check (person_id = identity.current_person_id());

-- ------------------------------------------------- Tasks HR gives you

create table work.assigned_tasks (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references identity.people(id) on delete cascade,
  title       text not null check (btrim(title) <> ''),
  note        text,
  due_on      date,
  done_at     timestamptz,
  -- Who set it. Kept when that account is closed rather than cascading:
  -- deleting the person should not quietly rewrite the history of a task
  -- somebody was asked to do.
  assigned_by uuid references identity.people(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index assigned_tasks_person_idx
  on work.assigned_tasks (person_id, done_at nulls first, due_on nulls last);

alter table work.assigned_tasks enable row level security;

-- You see the ones you were given. HR sees the ones in its own org.
create policy assigned_tasks_read on work.assigned_tasks
  for select to authenticated
  using (
    person_id = identity.current_person_id()
    or (identity.is_hr() and identity.same_org(person_id))
  );

-- Only HR writes the task itself. Note what is absent: no self-serve
-- insert. Assigning yourself work that then reads as assigned *to* you by
-- your employer is a different claim from writing it on your own list, and
-- private.tasks above is where that belongs.
create policy assigned_tasks_create on work.assigned_tasks
  for insert to authenticated
  with check (identity.is_hr() and identity.same_org(person_id));

create policy assigned_tasks_edit on work.assigned_tasks
  for update to authenticated
  using (identity.is_hr() and identity.same_org(person_id))
  with check (identity.is_hr() and identity.same_org(person_id));

create policy assigned_tasks_remove on work.assigned_tasks
  for delete to authenticated
  using (identity.is_hr() and identity.same_org(person_id));

/**
 * Tick, or un-tick, a task you were given.
 *
 * The update policy above is HR-only, which is deliberate: the person
 * doing the task may say whether it is done and nothing else. Letting them
 * update the row directly would mean a column-level rule to stop the title
 * and the due date being edited too, and Postgres RLS has no column-level
 * `with check`. A definer function that writes exactly one column is the
 * whole rule, stated once, with nothing left to configure.
 */
create or replace function public.set_assigned_task_done(
  p_id   uuid,
  p_done boolean
) returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update work.assigned_tasks
     set done_at = case when p_done then now() else null end
   where id = p_id
     and person_id = identity.current_person_id();

  -- Not found means it is somebody else's, or it does not exist. Both are
  -- the same answer from here, and saying which would confirm the id.
  if not found then
    raise exception 'That task is not yours to change.';
  end if;
end;
$$;

-- ---------------------------------------------------------------- Grants

grant select, insert, update, delete on private.tasks to authenticated;
grant select, insert, update, delete on work.assigned_tasks to authenticated;

-- Supabase's defaults hand out more than the list above regardless of what
-- is asked for (see 0028) — close what should stay shut explicitly.
revoke truncate, references, trigger
  on private.tasks, work.assigned_tasks from authenticated, anon;

revoke all on function public.set_assigned_task_done(uuid, boolean)
  from public, anon;
grant execute on function public.set_assigned_task_done(uuid, boolean)
  to authenticated;

-- ----------------------------------------------------------------- Views

create view public.tasks with (security_invoker = true) as
  select id, person_id, title, note, due_on, done_at, created_at
    from private.tasks;

create view public.assigned_tasks with (security_invoker = true) as
  select id, person_id, title, note, due_on, done_at, assigned_by, created_at
    from work.assigned_tasks;

grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.assigned_tasks to authenticated;

-- The API caches the schema it exposes and does not notice DDL. Without
-- this, the app asks for tables that exist and is told they do not — see
-- 0053, where exactly that happened.
notify pgrst, 'reload schema';
