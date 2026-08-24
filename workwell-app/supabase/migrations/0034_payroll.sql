-- Payroll, made real -- two tables where the mock had one hardcoded array.
--
-- Payslips are issued, not self-reported: there is no employee insert
-- policy for them at all, only HR of the same org (standing in for
-- whoever runs payroll, in the absence of an actual payroll integration
-- this product has no source of truth for). A person reads only their own.
--
-- payroll_requests is the same leave_requests shape as everything else
-- here: raise your own, HR of your org decides it, nobody decides their
-- own.
--
-- The page's own PrivacyNote claims a narrower audience than general HR
-- ("readable by ... whoever actually runs payroll, nobody else, including
-- other HR functions that don't need it"). That role split does not exist
-- in identity.person_roles -- there is only is_hr() -- so this migration
-- deliberately does NOT make that claim true. It uses the same is_hr()
-- gate as every other work-plane table. A real narrower payroll role is a
-- separate piece of work, not a side effect of wiring this page to a
-- database.

create table work.payslips (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references identity.people(id) on delete cascade,
  period_month date not null,
  gross        numeric(12,2) not null check (gross >= 0),
  net          numeric(12,2) not null check (net >= 0 and net <= gross),
  status       text not null default 'Processing'
               check (status in ('Processing','Paid')),
  created_at   timestamptz not null default now(),
  unique (person_id, period_month)
);

create index payslips_person_idx on work.payslips (person_id, period_month desc);

create table work.payroll_requests (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references identity.people(id) on delete cascade,
  kind       text not null
             check (kind in ('Pay advance','Increment review','Payslip correction')),
  note       text not null check (btrim(note) <> ''),
  status     text not null default 'Pending'
             check (status in ('Pending','Reviewing','Resolved','Declined')),
  decided_by uuid references identity.people(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index payroll_requests_person_idx on work.payroll_requests (person_id, created_at desc);
create index payroll_requests_status_idx on work.payroll_requests (status);

alter table work.payslips        enable row level security;
alter table work.payroll_requests enable row level security;

create policy payslips_read on work.payslips
  for select to authenticated
  using (
    person_id = identity.current_person_id()
    or (identity.is_hr() and identity.same_org(person_id))
  );

-- Standing in for a real payroll run: HR of the same org can record one.
create policy payslips_write on work.payslips
  for insert to authenticated
  with check (identity.is_hr() and identity.same_org(person_id));

create policy payslips_update on work.payslips
  for update to authenticated
  using (identity.is_hr() and identity.same_org(person_id))
  with check (identity.is_hr() and identity.same_org(person_id));

create policy payroll_requests_read on work.payroll_requests
  for select to authenticated
  using (
    person_id = identity.current_person_id()
    or (identity.is_hr() and identity.same_org(person_id))
  );

create policy payroll_requests_insert on work.payroll_requests
  for insert to authenticated
  with check (person_id = identity.current_person_id());

create policy payroll_requests_decide on work.payroll_requests
  for update to authenticated
  using (identity.is_hr() and identity.same_org(person_id))
  with check (identity.is_hr() and identity.same_org(person_id));

revoke delete, truncate, references, trigger
  on work.payslips, work.payroll_requests from authenticated, anon;
grant select, insert, update on work.payslips to authenticated;
grant select, insert, update on work.payroll_requests to authenticated;

create view public.payslips
  with (security_invoker = true)
  as select id, person_id, period_month, gross, net, status, created_at
       from work.payslips;

create view public.payroll_requests
  with (security_invoker = true)
  as select id, person_id, kind, note, status, decided_by, decided_at, created_at
       from work.payroll_requests;

revoke delete, truncate, references, trigger
  on public.payslips, public.payroll_requests from authenticated, anon;
grant select, insert, update on public.payslips to authenticated;
grant select, insert, update on public.payroll_requests to authenticated;

-- Demo seed: Celine is the one account with a real login this project's
-- test data actually uses, so she is the only person whose payslip history
-- would ever be looked at. Fixed values, not random() -- reproducible on a
-- fresh apply, same principle as 0030.
insert into work.payslips (person_id, period_month, gross, net, status)
select p.id, d.period_month::date, d.gross, d.net, d.status
from identity.people p
join auth.users u on u.id = p.auth_user_id
cross join (values
  ('2026-04-01', 62000.00, 51900.00, 'Paid'),
  ('2026-05-01', 62000.00, 51900.00, 'Paid'),
  ('2026-06-01', 65000.00, 54200.00, 'Paid'),
  ('2026-07-01', 65000.00, 54200.00, 'Paid'),
  ('2026-08-01', 65000.00, 54200.00, 'Processing')
) as d(period_month, gross, net, status)
where u.email = 'celine.nolasco@workwell.com'
on conflict (person_id, period_month) do nothing;
