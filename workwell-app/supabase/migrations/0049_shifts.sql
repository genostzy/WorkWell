-- Working hours, as an assignable schedule.
--
-- Attendance has always known when someone timed in and out, but never when
-- they were *supposed* to: attendance-client.tsx hardcoded a 12:00-13:00
-- meal pause with its own comment admitting "a real rollout would read this
-- from company policy instead of a constant". That constant is wrong for
-- anyone not on a 9-6 -- a night-shift worker got auto-paused at noon, in
-- the middle of their own morning off.
--
-- Shifts are org-scoped reference data HR maintains (same shape as holidays
-- and policies); an assignment is one row per person, because a person works
-- one schedule at a time. Everyone in the org can read the shift list -- an
-- employee has to be able to see the hours they were given.
--
-- Times are stored as `time`, not timestamptz: a shift is a wall-clock
-- pattern that repeats, not an instant. time_out < time_in means the shift
-- crosses midnight (the night and graveyard shifts below both do), and the
-- client resolves that against a real date when it needs one.

create table work.shifts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references identity.orgs(id) on delete cascade,
  name        text not null,
  time_in     time not null,
  meal_start  time not null,
  meal_end    time not null,
  time_out    time not null,
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);

create index shifts_org_idx on work.shifts (org_id, name);

alter table work.shifts enable row level security;

create policy shifts_read on work.shifts
  for select to authenticated
  using (org_id = identity.current_org_id());

create policy shifts_write on work.shifts
  for insert to authenticated
  with check (identity.is_hr() and org_id = identity.current_org_id());

create policy shifts_update on work.shifts
  for update to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id())
  with check (identity.is_hr() and org_id = identity.current_org_id());

create policy shifts_delete on work.shifts
  for delete to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id());

revoke truncate, references, trigger on work.shifts from authenticated, anon;
grant select, insert, update, delete on work.shifts to authenticated;

create view public.shifts
  with (security_invoker = true)
  as select id, org_id, name, time_in, meal_start, meal_end, time_out, created_at
       from work.shifts;

revoke truncate, references, trigger on public.shifts from authenticated, anon;
grant select, insert, update, delete on public.shifts to authenticated;

-- ------------------------------------------------------------ assignments

-- person_id is the primary key: one schedule at a time, so re-assigning is
-- an upsert rather than a second row nobody knows how to order.
create table work.shift_assignments (
  person_id   uuid primary key references identity.people(id) on delete cascade,
  shift_id    uuid not null references work.shifts(id) on delete cascade,
  assigned_by uuid references identity.people(id) on delete set null,
  assigned_at timestamptz not null default now()
);

create index shift_assignments_shift_idx on work.shift_assignments (shift_id);

alter table work.shift_assignments enable row level security;

-- Yours, or HR's for their own org -- the same read shape leave and expenses
-- already use. Your own working hours are not a thing to keep from you.
create policy shift_assignments_read on work.shift_assignments
  for select to authenticated
  using (
    person_id = identity.current_person_id()
    or (identity.is_hr() and identity.same_org(person_id))
  );

create policy shift_assignments_write on work.shift_assignments
  for insert to authenticated
  with check (identity.is_hr() and identity.same_org(person_id));

create policy shift_assignments_update on work.shift_assignments
  for update to authenticated
  using (identity.is_hr() and identity.same_org(person_id))
  with check (identity.is_hr() and identity.same_org(person_id));

create policy shift_assignments_delete on work.shift_assignments
  for delete to authenticated
  using (identity.is_hr() and identity.same_org(person_id));

revoke truncate, references, trigger on work.shift_assignments from authenticated, anon;
grant select, insert, update, delete on work.shift_assignments to authenticated;

create view public.shift_assignments
  with (security_invoker = true)
  as select person_id, shift_id, assigned_by, assigned_at
       from work.shift_assignments;

revoke truncate, references, trigger on public.shift_assignments from authenticated, anon;
grant select, insert, update, delete on public.shift_assignments to authenticated;

-- ------------------------------------------------------------------- seed

insert into work.shifts (org_id, name, time_in, meal_start, meal_end, time_out)
values
  ('a0000000-0000-0000-0000-000000000001', 'Morning shift',   '09:00', '12:00', '13:00', '18:00'),
  ('a0000000-0000-0000-0000-000000000001', 'Night shift',     '15:00', '19:00', '20:00', '00:00'),
  ('a0000000-0000-0000-0000-000000000001', 'Graveyard shift', '17:00', '19:00', '20:00', '02:00')
on conflict (org_id, name) do nothing;

insert into work.shift_assignments (person_id, shift_id)
select p.id, s.id
  from identity.people p
  join auth.users u on u.id = p.auth_user_id
  cross join work.shifts s
 where u.email = 'celine.nolasco@workwell.com'
   and s.org_id = p.org_id
   and s.name = 'Night shift'
on conflict (person_id) do update set shift_id = excluded.shift_id;
