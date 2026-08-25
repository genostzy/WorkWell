-- Wires 9 of the 10 remaining client-only mock pages to real tables, same
-- work-plane/RLS shape as leave_requests, expenses and payroll (0011,
-- 0033, 0034): read is self-or-HR-of-your-org, write is narrowed per verb,
-- explicit revokes close what the default grants would otherwise leave
-- open (see 0028).
--
-- warnings is deliberately NOT included. Its own PrivacyNote already says
-- persistence next to work-plane data "is worth deciding on purpose, with
-- whoever owns HR policy... What is mocked below is one option, not a
-- decided design" — wiring it up would contradict what the page itself
-- says about its own state. It stays a client-only mock until someone
-- actually makes that call.

-- ---------------------------------------------------------------- holidays
-- Company calendar. Org-wide reference data, not person-owned — same
-- category as payslips (0034): HR of the org can maintain it, but there is
-- no HR authoring UI yet, so it ships seeded rather than empty.
create table work.holidays (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references identity.orgs(id) on delete cascade,
  observed_on  date not null,
  name         text not null,
  created_at   timestamptz not null default now(),
  unique (org_id, observed_on, name)
);

create index holidays_org_idx on work.holidays (org_id, observed_on);

alter table work.holidays enable row level security;

create policy holidays_read on work.holidays
  for select to authenticated
  using (org_id = identity.current_org_id());

create policy holidays_write on work.holidays
  for insert to authenticated
  with check (identity.is_hr() and org_id = identity.current_org_id());

create policy holidays_update on work.holidays
  for update to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id())
  with check (identity.is_hr() and org_id = identity.current_org_id());

revoke delete, truncate, references, trigger
  on work.holidays from authenticated, anon;
grant select, insert, update on work.holidays to authenticated;

create view public.holidays
  with (security_invoker = true)
  as select id, org_id, observed_on, name, created_at
       from work.holidays;

revoke delete, truncate, references, trigger
  on public.holidays from authenticated, anon;
grant select, insert, update on public.holidays to authenticated;

-- ------------------------------------------------------------------ assets
-- Issued, not self-reported — same reasoning as payslips (0034): equipment
-- assignment is an inventory action nothing here has a real source of
-- truth for, so HR issues rows and the employee's only write is reporting
-- a fault on their own.
create table work.assets (
  id              uuid primary key default gen_random_uuid(),
  person_id       uuid not null references identity.people(id) on delete cascade,
  tag             text not null,
  asset_type      text not null,
  issued_on       date not null default current_date,
  condition       text not null default 'Good' check (condition in ('Good','Fair','Poor')),
  issue_reported  boolean not null default false,
  issue_note      text,
  created_at      timestamptz not null default now(),
  unique (person_id, tag)
);

create index assets_person_idx on work.assets (person_id, created_at desc);

alter table work.assets enable row level security;

create policy assets_read on work.assets
  for select to authenticated
  using (
    person_id = identity.current_person_id()
    or (identity.is_hr() and identity.same_org(person_id))
  );

create policy assets_issue on work.assets
  for insert to authenticated
  with check (identity.is_hr() and identity.same_org(person_id));

-- Self may update their own row (reporting a fault); HR may update any row
-- in their org (recording a fix, reissuing).
create policy assets_self_update on work.assets
  for update to authenticated
  using (person_id = identity.current_person_id())
  with check (person_id = identity.current_person_id());

create policy assets_hr_update on work.assets
  for update to authenticated
  using (identity.is_hr() and identity.same_org(person_id))
  with check (identity.is_hr() and identity.same_org(person_id));

revoke delete, truncate, references, trigger
  on work.assets from authenticated, anon;
grant select, insert, update on work.assets to authenticated;

create view public.assets
  with (security_invoker = true)
  as select id, person_id, tag, asset_type, issued_on, condition,
            issue_reported, issue_note, created_at
       from work.assets;

revoke delete, truncate, references, trigger
  on public.assets from authenticated, anon;
grant select, insert, update on public.assets to authenticated;

-- -------------------------------------------------------------- news_posts
-- Broadcast content, org-wide. No authoring UI yet (same gap as
-- holidays/payslips) — HR of the org can write, ships seeded.
create table work.news_posts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references identity.orgs(id) on delete cascade,
  title       text not null,
  body        text not null,
  posted_on   date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (org_id, title)
);

create index news_posts_org_idx on work.news_posts (org_id, posted_on desc);

alter table work.news_posts enable row level security;

create policy news_posts_read on work.news_posts
  for select to authenticated
  using (org_id = identity.current_org_id());

create policy news_posts_write on work.news_posts
  for insert to authenticated
  with check (identity.is_hr() and org_id = identity.current_org_id());

create policy news_posts_update on work.news_posts
  for update to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id())
  with check (identity.is_hr() and org_id = identity.current_org_id());

revoke delete, truncate, references, trigger
  on work.news_posts from authenticated, anon;
grant select, insert, update on work.news_posts to authenticated;

create view public.news_posts
  with (security_invoker = true)
  as select id, org_id, title, body, posted_on, created_at
       from work.news_posts;

revoke delete, truncate, references, trigger
  on public.news_posts from authenticated, anon;
grant select, insert, update on public.news_posts to authenticated;

-- --------------------------------------------------------------- complaints
-- Same leave_requests shape: raise your own, HR of your org decides it,
-- nobody decides their own.
create table work.complaints (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references identity.people(id) on delete cascade,
  summary     text not null check (btrim(summary) <> ''),
  status      text not null default 'Submitted'
              check (status in ('Submitted','In review','Resolved')),
  decided_by  uuid references identity.people(id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index complaints_person_idx on work.complaints (person_id, created_at desc);
create index complaints_status_idx on work.complaints (status);

alter table work.complaints enable row level security;

create policy complaints_read on work.complaints
  for select to authenticated
  using (
    person_id = identity.current_person_id()
    or (identity.is_hr() and identity.same_org(person_id))
  );

create policy complaints_insert on work.complaints
  for insert to authenticated
  with check (person_id = identity.current_person_id());

create policy complaints_decide on work.complaints
  for update to authenticated
  using (identity.is_hr() and identity.same_org(person_id))
  with check (identity.is_hr() and identity.same_org(person_id));

revoke delete, truncate, references, trigger
  on work.complaints from authenticated, anon;
grant select, insert, update on work.complaints to authenticated;

create view public.complaints
  with (security_invoker = true)
  as select id, person_id, summary, status, decided_by, decided_at, created_at
       from work.complaints;

revoke delete, truncate, references, trigger
  on public.complaints from authenticated, anon;
grant select, insert, update on public.complaints to authenticated;

-- ---------------------------------------------------- policies / policy_acks
-- Policy documents are org-wide reference data (seeded, HR-maintained, same
-- as holidays/news). Acknowledging one is the person-owned part: an insert
-- you make for yourself, read by you and by HR of your org.
create table work.policies (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references identity.orgs(id) on delete cascade,
  title       text not null,
  updated_on  date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (org_id, title)
);

create index policies_org_idx on work.policies (org_id);

create table work.policy_acks (
  id          uuid primary key default gen_random_uuid(),
  policy_id   uuid not null references work.policies(id) on delete cascade,
  person_id   uuid not null references identity.people(id) on delete cascade,
  acked_at    timestamptz not null default now(),
  unique (policy_id, person_id)
);

create index policy_acks_person_idx on work.policy_acks (person_id);

alter table work.policies    enable row level security;
alter table work.policy_acks enable row level security;

create policy policies_read on work.policies
  for select to authenticated
  using (org_id = identity.current_org_id());

create policy policies_write on work.policies
  for insert to authenticated
  with check (identity.is_hr() and org_id = identity.current_org_id());

create policy policies_update on work.policies
  for update to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id())
  with check (identity.is_hr() and org_id = identity.current_org_id());

create policy policy_acks_read on work.policy_acks
  for select to authenticated
  using (
    person_id = identity.current_person_id()
    or (identity.is_hr() and identity.same_org(person_id))
  );

-- You may only acknowledge for yourself.
create policy policy_acks_insert on work.policy_acks
  for insert to authenticated
  with check (person_id = identity.current_person_id());

revoke delete, truncate, references, trigger
  on work.policies from authenticated, anon;
revoke delete, truncate, references, trigger
  on work.policy_acks from authenticated, anon;
grant select, insert, update on work.policies to authenticated;
grant select, insert on work.policy_acks to authenticated;

create view public.policies
  with (security_invoker = true)
  as select id, org_id, title, updated_on, created_at
       from work.policies;

create view public.policy_acks
  with (security_invoker = true)
  as select id, policy_id, person_id, acked_at
       from work.policy_acks;

revoke delete, truncate, references, trigger
  on public.policies from authenticated, anon;
revoke delete, truncate, references, trigger
  on public.policy_acks from authenticated, anon;
grant select, insert, update on public.policies to authenticated;
grant select, insert on public.policy_acks to authenticated;

-- ------------------------------------------------------------- resignations
-- Same leave_requests shape, plus a self-serve withdraw: you may take back
-- your own notice while it is still unacknowledged, the one self-update
-- this family of tables grants anywhere (still your own row, still no
-- reach into anyone else's).
create table work.resignations (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references identity.people(id) on delete cascade,
  last_day    date not null,
  reason      text,
  status      text not null default 'Submitted'
              check (status in ('Submitted','Acknowledged','Withdrawn')),
  decided_by  uuid references identity.people(id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index resignations_person_idx on work.resignations (person_id, created_at desc);
create index resignations_status_idx on work.resignations (status);

alter table work.resignations enable row level security;

create policy resignations_read on work.resignations
  for select to authenticated
  using (
    person_id = identity.current_person_id()
    or (identity.is_hr() and identity.same_org(person_id))
  );

create policy resignations_insert on work.resignations
  for insert to authenticated
  with check (person_id = identity.current_person_id());

create policy resignations_decide on work.resignations
  for update to authenticated
  using (identity.is_hr() and identity.same_org(person_id))
  with check (identity.is_hr() and identity.same_org(person_id));

create policy resignations_withdraw on work.resignations
  for update to authenticated
  using (person_id = identity.current_person_id() and status = 'Submitted')
  with check (person_id = identity.current_person_id());

revoke delete, truncate, references, trigger
  on work.resignations from authenticated, anon;
grant select, insert, update on work.resignations to authenticated;

create view public.resignations
  with (security_invoker = true)
  as select id, person_id, last_day, reason, status, decided_by, decided_at, created_at
       from work.resignations;

revoke delete, truncate, references, trigger
  on public.resignations from authenticated, anon;
grant select, insert, update on public.resignations to authenticated;

-- ----------------------------------------------------------- custom_fields
-- HR-authored schema, org-scoped. Definitions only — the per-employee
-- values side (custom-field-values.tsx) was removed earlier this session
-- as an orphan never wired to anything; not reintroduced here.
create table work.custom_fields (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references identity.orgs(id) on delete cascade,
  name        text not null,
  field_type  text not null check (field_type in ('Text','Number','Date','Select')),
  created_at  timestamptz not null default now()
);

create index custom_fields_org_idx on work.custom_fields (org_id);

alter table work.custom_fields enable row level security;

create policy custom_fields_read on work.custom_fields
  for select to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id());

create policy custom_fields_write on work.custom_fields
  for insert to authenticated
  with check (identity.is_hr() and org_id = identity.current_org_id());

revoke delete, truncate, references, trigger
  on work.custom_fields from authenticated, anon;
grant select, insert on work.custom_fields to authenticated;

create view public.custom_fields
  with (security_invoker = true)
  as select id, org_id, name, field_type, created_at
       from work.custom_fields;

revoke delete, truncate, references, trigger
  on public.custom_fields from authenticated, anon;
grant select, insert on public.custom_fields to authenticated;

-- ------------------------------------------------------- offboarding_checklist
-- HR-only, same_org(person_id) gated — the "who's leaving" list on the
-- client side is sourced from work.resignations, not stored again here.
create table work.offboarding_checklist (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references identity.people(id) on delete cascade,
  item_key    text not null check (item_key in ('assets','access','lastday','finalpay','exit')),
  done        boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (person_id, item_key)
);

create index offboarding_checklist_person_idx on work.offboarding_checklist (person_id);

alter table work.offboarding_checklist enable row level security;

create policy offboarding_checklist_read on work.offboarding_checklist
  for select to authenticated
  using (identity.is_hr() and identity.same_org(person_id));

create policy offboarding_checklist_write on work.offboarding_checklist
  for insert to authenticated
  with check (identity.is_hr() and identity.same_org(person_id));

create policy offboarding_checklist_update on work.offboarding_checklist
  for update to authenticated
  using (identity.is_hr() and identity.same_org(person_id))
  with check (identity.is_hr() and identity.same_org(person_id));

revoke delete, truncate, references, trigger
  on work.offboarding_checklist from authenticated, anon;
grant select, insert, update on work.offboarding_checklist to authenticated;

create view public.offboarding_checklist
  with (security_invoker = true)
  as select id, person_id, item_key, done, updated_at
       from work.offboarding_checklist;

revoke delete, truncate, references, trigger
  on public.offboarding_checklist from authenticated, anon;
grant select, insert, update on public.offboarding_checklist to authenticated;

-- --------------------------------------------------------------------- seed
-- Fixed values against the fixed demo org/people ids from 0006, not
-- random() — reproducible on a fresh apply, same principle as 0030/0034.
insert into work.holidays (org_id, observed_on, name)
values
  ('a0000000-0000-0000-0000-000000000001', '2026-01-01', 'New Year''s Day'),
  ('a0000000-0000-0000-0000-000000000001', '2026-02-25', 'EDSA People Power Anniversary'),
  ('a0000000-0000-0000-0000-000000000001', '2026-04-03', 'Good Friday'),
  ('a0000000-0000-0000-0000-000000000001', '2026-05-01', 'Labour Day'),
  ('a0000000-0000-0000-0000-000000000001', '2026-06-12', 'Independence Day'),
  ('a0000000-0000-0000-0000-000000000001', '2026-08-21', 'Ninoy Aquino Day'),
  ('a0000000-0000-0000-0000-000000000001', '2026-08-31', 'National Heroes Day'),
  ('a0000000-0000-0000-0000-000000000001', '2026-11-30', 'Bonifacio Day'),
  ('a0000000-0000-0000-0000-000000000001', '2026-12-25', 'Christmas Day'),
  ('a0000000-0000-0000-0000-000000000001', '2026-12-30', 'Rizal Day')
on conflict (org_id, observed_on, name) do nothing;

insert into work.news_posts (org_id, title, body, posted_on)
values
  ('a0000000-0000-0000-0000-000000000001',
   'Office closed for the long weekend',
   'With National Heroes Day landing on a Monday, the office stays closed through the weekend. Nothing to action — this is a heads-up, not a request.',
   '2026-08-14'),
  ('a0000000-0000-0000-0000-000000000001',
   'New benefits partner starting next quarter',
   'HR is finalising a switch in HMO provider. Coverage details and the transition timeline will follow once the contract is signed — nothing changes before then.',
   '2026-08-05'),
  ('a0000000-0000-0000-0000-000000000001',
   'Building Wi-Fi upgrade this Saturday',
   'IT is replacing the access points floor by floor this Saturday. Expect brief drops if anyone is in over the weekend; everything should be back by Monday morning.',
   '2026-07-29')
on conflict (org_id, title) do nothing;

insert into work.policies (org_id, title, updated_on)
values
  ('a0000000-0000-0000-0000-000000000001', 'Code of conduct', '2026-01-12'),
  ('a0000000-0000-0000-0000-000000000001', 'Leave and time off', '2026-02-03'),
  ('a0000000-0000-0000-0000-000000000001', 'Data & device security', '2026-04-20'),
  ('a0000000-0000-0000-0000-000000000001', 'Anti-harassment policy', '2026-05-15'),
  ('a0000000-0000-0000-0000-000000000001', 'Expense reimbursement', '2026-06-01')
on conflict (org_id, title) do nothing;

insert into work.assets (person_id, tag, asset_type, issued_on, condition)
select p.id, d.tag, d.asset_type, d.issued_on::date, d.condition
from identity.people p
join auth.users u on u.id = p.auth_user_id
cross join (values
  ('WW-LT-0142', 'Laptop — 14"',    '2025-03-10', 'Good'),
  ('WW-BD-0891', 'Access badge',     '2025-03-10', 'Good'),
  ('WW-MN-0207', 'External monitor', '2025-09-02', 'Fair')
) as d(tag, asset_type, issued_on, condition)
where u.email = 'celine.nolasco@workwell.com'
on conflict (person_id, tag) do nothing;
