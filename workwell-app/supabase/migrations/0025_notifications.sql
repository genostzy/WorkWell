-- 0025: Notifications — the missing ping when a decision is made.
-- Employee-owned: you see your own, HR can create but not read employee notifications.

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

-- Employee sees their own. HR can insert (to notify) but cannot read employee notifications.
create policy notifications_read on work.notifications
  for select to authenticated
  using (person_id = identity.current_person_id());

create policy notifications_insert on work.notifications
  for insert to authenticated
  with check (true);

create policy notifications_update on work.notifications
  for update to authenticated
  using (person_id = identity.current_person_id())
  with check (person_id = identity.current_person_id());

grant select, insert, update on work.notifications to authenticated;

create view public.notifications with (security_invoker = true) as
  select id, person_id, kind, title, body, link, read, created_at
    from work.notifications;

grant select, insert, update on public.notifications to authenticated;
