-- The work plane: employment data.
--
-- This is the category the employer legitimately holds. HR sees a leave
-- balance; HR never sees how the week felt. Keeping it in its own schema
-- is what makes that sentence structural rather than aspirational.

-- Two helpers, both security definer for the same reason the resolvers
-- are: policies call them, and reading identity.* from inside a policy on
-- identity.* would recurse.
create or replace function identity.is_hr() returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from identity.person_roles
     where person_id = identity.current_person_id()
       and role = 'hr'
  )
$$;

-- "Is this person in my org?" Definer so the caller's RLS on people does
-- not silently narrow the answer.
create or replace function identity.same_org(p uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from identity.people
     where id = p
       and org_id = identity.current_org_id()
  )
$$;

revoke all on function identity.is_hr() from public;
revoke all on function identity.same_org(uuid) from public;
grant execute on function identity.is_hr() to authenticated;
grant execute on function identity.same_org(uuid) to authenticated;

create table work.employment (
  person_id     uuid primary key references identity.people(id) on delete cascade,
  job_title     text not null,
  department    text not null,
  team          text,
  manager_name  text,
  contract_type text not null default 'Full time',
  location      text,
  started_on    date not null,
  entitlement   int  not null default 20,
  created_at    timestamptz not null default now()
);

create index employment_department_idx on work.employment (department);

create table work.leave_requests (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references identity.people(id) on delete cascade,
  kind       text not null check (kind in ('Annual','Sick','Unpaid','Bereavement')),
  starts_on  date not null,
  ends_on    date not null,
  note       text,
  status     text not null default 'pending'
             check (status in ('pending','approved','declined')),
  decided_by uuid references identity.people(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index leave_person_idx on work.leave_requests (person_id, starts_on desc);
create index leave_status_idx on work.leave_requests (status);

alter table work.employment     enable row level security;
alter table work.leave_requests enable row level security;

-- You see your own record. HR sees the records of their own org, and
-- nothing beyond it. Note what is absent: no policy anywhere grants HR
-- reach into private.check_ins.
create policy employment_read on work.employment
  for select to authenticated
  using (
    person_id = identity.current_person_id()
    or (identity.is_hr() and identity.same_org(person_id))
  );

create policy leave_read on work.leave_requests
  for select to authenticated
  using (
    person_id = identity.current_person_id()
    or (identity.is_hr() and identity.same_org(person_id))
  );

-- You may raise leave for yourself only.
create policy leave_insert on work.leave_requests
  for insert to authenticated
  with check (person_id = identity.current_person_id());

-- Only HR decides, and only for their own org. Deliberately no self-serve
-- update for the requester: approving your own leave is exactly the thing
-- an approval flow exists to prevent.
create policy leave_decide on work.leave_requests
  for update to authenticated
  using (identity.is_hr() and identity.same_org(person_id))
  with check (identity.is_hr() and identity.same_org(person_id));

grant usage on schema work to authenticated;
grant select on work.employment to authenticated;
grant select, insert, update on work.leave_requests to authenticated;

create view public.employment
  with (security_invoker = true)
  as select person_id, job_title, department, team, manager_name,
            contract_type, location, started_on, entitlement
       from work.employment;

create view public.leave_requests
  with (security_invoker = true)
  as select id, person_id, kind, starts_on, ends_on, note, status,
            decided_by, decided_at, created_at
       from work.leave_requests;

grant select on public.employment to authenticated;
grant select, insert, update on public.leave_requests to authenticated;
