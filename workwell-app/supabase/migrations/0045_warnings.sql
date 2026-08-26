-- Warnings, made real.
--
-- Left deliberately mock since 0037 (see that migration's own note): a
-- disciplinary record is a judgement about a person, not the neutral
-- employment fact the rest of the work plane holds, and putting it next to
-- private-plane data was worth a real decision rather than a default. That
-- decision: persist it, tied to a real person like every other record here,
-- and the person it's about can see it -- the same visibility Expenses and
-- Complaints already give their own subject. Never deletable, only
-- resolvable, matching Payslips' stance on financial/disciplinary
-- permanence. Resolving is one-way (Active -> Resolved only) so HR cannot
-- quietly reopen a closed record either.
create table work.warnings (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references identity.people(id) on delete cascade,
  category    text not null check (category in ('Attendance','Conduct','Performance','Policy breach')),
  note        text not null check (btrim(note) <> ''),
  status      text not null default 'Active' check (status in ('Active','Resolved')),
  issued_by   uuid references identity.people(id) on delete set null,
  resolved_by uuid references identity.people(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index warnings_person_idx on work.warnings (person_id, created_at desc);

alter table work.warnings enable row level security;

create policy warnings_read on work.warnings
  for select to authenticated
  using (
    person_id = identity.current_person_id()
    or (identity.is_hr() and identity.same_org(person_id))
  );

create policy warnings_write on work.warnings
  for insert to authenticated
  with check (identity.is_hr() and identity.same_org(person_id));

create policy warnings_resolve on work.warnings
  for update to authenticated
  using (status = 'Active' and identity.is_hr() and identity.same_org(person_id))
  with check (status = 'Resolved' and identity.is_hr() and identity.same_org(person_id));

revoke delete, truncate, references, trigger
  on work.warnings from authenticated, anon;
grant select, insert, update on work.warnings to authenticated;

create view public.warnings
  with (security_invoker = true)
  as select id, person_id, category, note, status, issued_by, resolved_by, resolved_at, created_at
       from work.warnings;

revoke delete, truncate, references, trigger
  on public.warnings from authenticated, anon;
grant select, insert, update on public.warnings to authenticated;
