-- Carried forward from main's 0025_notifications.sql (this branch renumbers
-- it to avoid colliding with 0024/0025/0026, which main also used for a
-- 12-table "wire the mocks" migration and a decision-history/attendance
-- migration -- both skipped here: unwired to any client code, and
-- work.attendance directly conflicts with the private.attendance already
-- built and shipped this session (0027-0032). Content otherwise unchanged.
--
-- The missing ping when a decision is made. hr/decide.tsx already inserts
-- into this on every leave decision; nothing renders it in the UI yet
-- (shell.tsx has no bell/list for it) -- writes succeed, nothing surfaces
-- them. A real gap, not a regression: same as main's own current state.

create table work.notifications (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references identity.people(id) on delete cascade,
  kind       text not null check (kind in (
    'leave_decided', 'expense_decided', 'complaint_updated',
    'resignation_updated', 'salary_decided', 'warning_issued',
    'offboarding_updated', 'access_approved', 'access_declined'
  )),
  title      text not null,
  body       text,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_person_idx on work.notifications (person_id, read, created_at desc);

alter table work.notifications enable row level security;

-- Employee sees their own. HR can insert (to notify) but cannot read
-- employee notifications.
create policy notifications_read on work.notifications
  for select to authenticated
  using (person_id = identity.current_person_id());

create policy notifications_insert on work.notifications
  for insert to authenticated
  with check (true);

-- Marking your own notifications read is the only update an employee
-- ever does here.
create policy notifications_update on work.notifications
  for update to authenticated
  using (person_id = identity.current_person_id())
  with check (person_id = identity.current_person_id());

revoke delete, truncate, references, trigger
  on work.notifications from authenticated, anon;
grant select, insert, update on work.notifications to authenticated;

create view public.notifications
  with (security_invoker = true)
  as select id, person_id, kind, title, body, link, read, created_at
       from work.notifications;

revoke delete, truncate, references, trigger
  on public.notifications from authenticated, anon;
grant select, insert, update on public.notifications to authenticated;
