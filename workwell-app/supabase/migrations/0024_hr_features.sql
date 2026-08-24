-- 0024: HR features — the 12 pages that were frontend-only mocks.
-- All in the work schema. Same policy shape: you see your own, HR sees all in the org.

-- ================================================================ EXPENSES
create table work.expenses (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references identity.people(id) on delete cascade,
  description text not null,
  amount      numeric(10,2) not null check (amount > 0),
  category    text not null check (category in ('Travel','Meals','Equipment','Software','Other')),
  receipt_url text,
  status      text not null default 'pending'
              check (status in ('pending','approved','declined')),
  decided_by  uuid references identity.people(id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index expenses_person_idx on work.expenses (person_id, created_at desc);
create index expenses_status_idx on work.expenses (status);

-- ================================================================ PAYSLIPS
create table work.payslips (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references identity.people(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  gross        numeric(10,2),
  deductions   numeric(10,2),
  net          numeric(10,2),
  status       text not null default 'available'
               check (status in ('available','viewed')),
  created_at   timestamptz not null default now()
);
create index payslips_person_idx on work.payslips (person_id, period_start desc);

-- ============================================================ SALARY REQUESTS
create table work.salary_requests (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references identity.people(id) on delete cascade,
  kind       text not null check (kind in ('advance','increment','promotion')),
  detail     text,
  status     text not null default 'pending'
             check (status in ('pending','approved','declined')),
  decided_by uuid references identity.people(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index salary_requests_person_idx on work.salary_requests (person_id, created_at desc);

-- ================================================================ WARNINGS
create table work.warnings (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references identity.people(id) on delete cascade,
  reason     text not null,
  issued_by  uuid references identity.people(id) on delete set null,
  issued_on  date not null,
  level      text not null check (level in ('verbal','written','final')),
  notes      text,
  created_at timestamptz not null default now()
);
create index warnings_person_idx on work.warnings (person_id, issued_on desc);

-- ================================================================ HOLIDAYS
create table work.holidays (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  starts_on  date not null,
  ends_on    date not null,
  recurring  boolean not null default false,
  created_by uuid references identity.people(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

-- ================================================================ ASSETS
create table work.assets (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid references identity.people(id) on delete set null,
  name          text not null,
  kind          text not null default 'Equipment',
  serial_number text,
  issued_on     date not null default current_date,
  returned_on   date,
  status        text not null default 'issued'
                check (status in ('issued','returned')),
  notes         text,
  created_at    timestamptz not null default now()
);
create index assets_person_idx on work.assets (person_id);

-- ================================================================== NEWS
create table work.news (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  pinned     boolean not null default false,
  created_by uuid references identity.people(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================== COMPLAINTS
create table work.complaints (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references identity.people(id) on delete cascade,
  subject    text not null,
  body       text not null,
  category   text not null check (category in ('workplace','management','harassment','safety','other')),
  status     text not null default 'open'
             check (status in ('open','investigating','resolved','closed')),
  decided_by uuid references identity.people(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index complaints_person_idx on work.complaints (person_id, created_at desc);

-- =========================================================== COMPANY POLICIES
create table work.company_policies (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  category     text not null default 'general',
  effective_on date,
  version      text,
  created_by   uuid references identity.people(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ============================================================ RESIGNATIONS
create table work.resignations (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references identity.people(id) on delete cascade,
  last_day   date not null,
  reason     text,
  status     text not null default 'submitted'
             check (status in ('submitted','acknowledged','accepted')),
  decided_by uuid references identity.people(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index resignations_person_idx on work.resignations (person_id);

-- ============================================================ LETTER HEADS
create table work.letter_heads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  body       text not null,
  created_by uuid references identity.people(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =========================================================== CUSTOM FIELDS
create table work.custom_field_defs (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  field_type text not null default 'text' check (field_type in ('text','number','date','select')),
  options    text[],
  required   boolean not null default false,
  created_by uuid references identity.people(id) on delete set null,
  created_at timestamptz not null default now()
);

create table work.custom_field_values (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references identity.people(id) on delete cascade,
  field_id   uuid not null references work.custom_field_defs(id) on delete cascade,
  value      text,
  created_at timestamptz not null default now(),
  unique (person_id, field_id)
);

-- ============================================================ OFFBOARDING
create table work.offboarding_checklists (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references identity.people(id) on delete cascade,
  asset_returned     boolean not null default false,
  access_revoked     boolean not null default false,
  last_day_confirmed boolean not null default false,
  equipment_returned boolean not null default false,
  handover_done      boolean not null default false,
  notes              text,
  created_by         uuid references identity.people(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- ================================================================ RLS
alter table work.expenses enable row level security;
alter table work.payslips enable row level security;
alter table work.salary_requests enable row level security;
alter table work.warnings enable row level security;
alter table work.holidays enable row level security;
alter table work.assets enable row level security;
alter table work.news enable row level security;
alter table work.complaints enable row level security;
alter table work.company_policies enable row level security;
alter table work.resignations enable row level security;
alter table work.letter_heads enable row level security;
alter table work.custom_field_defs enable row level security;
alter table work.custom_field_values enable row level security;
alter table work.offboarding_checklists enable row level security;

-- Employee-owned: you see your own, HR sees all in your org
create policy expenses_own on work.expenses
  for all to authenticated
  using (person_id = identity.current_person_id()
         or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id());

create policy payslips_own on work.payslips
  for all to authenticated
  using (person_id = identity.current_person_id()
         or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id());

create policy salary_requests_own on work.salary_requests
  for all to authenticated
  using (person_id = identity.current_person_id()
         or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id());

create policy complaints_own on work.complaints
  for all to authenticated
  using (person_id = identity.current_person_id()
         or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id());

create policy resignations_own on work.resignations
  for all to authenticated
  using (person_id = identity.current_person_id()
         or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id());

create policy custom_field_values_own on work.custom_field_values
  for all to authenticated
  using (person_id = identity.current_person_id()
         or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id());

create policy offboarding_own on work.offboarding_checklists
  for all to authenticated
  using (person_id = identity.current_person_id()
         or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id());

create policy assets_own on work.assets
  for all to authenticated
  using (person_id = identity.current_person_id()
         or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id());

-- HR-only: employees never see warnings
create policy warnings_hr on work.warnings
  for all to authenticated
  using (identity.is_hr() and identity.same_org(person_id))
  with check (identity.is_hr() and identity.same_org(person_id));

-- Company-wide: everyone reads, HR manages
create policy holidays_all on work.holidays
  for all to authenticated
  using (true) with check (identity.is_hr());

create policy news_all on work.news
  for all to authenticated
  using (true) with check (identity.is_hr());

create policy company_policies_all on work.company_policies
  for all to authenticated
  using (true) with check (identity.is_hr());

-- HR-only management
create policy letter_heads_hr on work.letter_heads
  for all to authenticated
  using (identity.is_hr()) with check (identity.is_hr());

create policy custom_field_defs_hr on work.custom_field_defs
  for all to authenticated
  using (identity.is_hr()) with check (identity.is_hr());

-- ================================================================ GRANTS
grant select, insert, update, delete on
  work.expenses, work.payslips, work.salary_requests,
  work.warnings, work.holidays, work.assets,
  work.news, work.complaints, work.company_policies,
  work.resignations, work.letter_heads,
  work.custom_field_defs, work.custom_field_values,
  work.offboarding_checklists
  to authenticated;

-- ================================================================ VIEWS
create view public.expenses with (security_invoker = true) as
  select id, person_id, description, amount, category, receipt_url,
         status, decided_by, decided_at, created_at from work.expenses;

create view public.payslips with (security_invoker = true) as
  select id, person_id, period_start, period_end, gross, deductions,
         net, status, created_at from work.payslips;

create view public.salary_requests with (security_invoker = true) as
  select id, person_id, kind, detail, status, decided_by,
         decided_at, created_at from work.salary_requests;

create view public.warnings with (security_invoker = true) as
  select id, person_id, reason, issued_by, issued_on, level,
         notes, created_at from work.warnings;

create view public.holidays with (security_invoker = true) as
  select id, name, starts_on, ends_on, recurring,
         created_by, created_at from work.holidays;

create view public.assets with (security_invoker = true) as
  select id, person_id, name, kind, serial_number, issued_on,
         returned_on, status, notes, created_at from work.assets;

create view public.news with (security_invoker = true) as
  select id, title, body, pinned, created_by, created_at from work.news;

create view public.complaints with (security_invoker = true) as
  select id, person_id, subject, body, category, status,
         decided_by, decided_at, created_at from work.complaints;

create view public.company_policies with (security_invoker = true) as
  select id, title, description, category, effective_on,
         version, created_by, created_at from work.company_policies;

create view public.resignations with (security_invoker = true) as
  select id, person_id, last_day, reason, status, decided_by,
         decided_at, created_at from work.resignations;

create view public.letter_heads with (security_invoker = true) as
  select id, name, body, created_by, created_at from work.letter_heads;

create view public.custom_field_defs with (security_invoker = true) as
  select id, label, field_type, options, required,
         created_by, created_at from work.custom_field_defs;

create view public.custom_field_values with (security_invoker = true) as
  select id, person_id, field_id, value, created_at
    from work.custom_field_values;

create view public.offboarding_checklists with (security_invoker = true) as
  select id, person_id, asset_returned, access_revoked,
         last_day_confirmed, equipment_returned, handover_done,
         notes, created_by, created_at from work.offboarding_checklists;

grant select, insert, update, delete on
  public.expenses, public.payslips, public.salary_requests,
  public.complaints, public.resignations,
  public.custom_field_values, public.offboarding_checklists,
  public.assets
  to authenticated;

grant select, insert, update, delete on
  public.holidays, public.news, public.company_policies
  to authenticated;

grant select, insert, update, delete on
  public.warnings, public.letter_heads, public.custom_field_defs
  to authenticated;
