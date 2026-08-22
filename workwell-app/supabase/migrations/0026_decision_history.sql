-- 0026: Decision history, search helpers, and export support.
-- A read-only view that HR can query to see what they decided and when.

-- ============================================================ DECISION HISTORY
-- Unified view of every approval/decision across the product.
create or replace view public.decision_history with (security_invoker = true) as
  select 'leave' as domain, id, person_id, status, decided_by, decided_at, created_at
    from work.leave_requests where decided_at is not null
  union all
  select 'expense', id, person_id, status, decided_by, decided_at, created_at
    from work.expenses where decided_at is not null
  union all
  select 'complaint', id, person_id, status, decided_by, decided_at, created_at
    from work.complaints where decided_at is not null
  union all
  select 'resignation', id, person_id, status, decided_by, decided_at, created_at
    from work.resignations where decided_at is not null
  union all
  select 'salary_request', id, person_id, status, decided_by, decided_at, created_at
    from work.salary_requests where decided_at is not null
  union all
  select 'access_request', id, null::uuid, status, decided_by, decided_at, created_at
    from identity.access_requests where decided_at is not null;

grant select on public.decision_history to authenticated;

-- ============================================================ ATTENDANCE
-- The attendance page was listed as live but was still a placeholder.
-- Build a minimal clock-in/out log. Employee clocks in and out; HR can
-- see the log and request resets (for forgotten clock-outs).

create table work.attendance (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references identity.people(id) on delete cascade,
  clock_in    timestamptz not null,
  clock_out   timestamptz,
  date        date not null default current_date,
  note        text,
  created_at  timestamptz not null default now()
);

create index attendance_person_date_idx on work.attendance (person_id, date desc);

alter table work.attendance enable row level security;

create policy attendance_own on work.attendance
  for all to authenticated
  using (person_id = identity.current_person_id()
         or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id());

grant select, insert, update on work.attendance to authenticated;

create view public.attendance with (security_invoker = true) as
  select id, person_id, clock_in, clock_out, date, note, created_at
    from work.attendance;

grant select, insert, update on public.attendance to authenticated;

-- RPC: clock in (inserts a row for today if none exists)
create or replace function public.clock_in(p_note text default null)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  me uuid := identity.current_person_id();
begin
  if me is null then
    raise exception 'this account is not linked to a person' using errcode = '42501';
  end if;

  if exists (
    select 1 from work.attendance
     where person_id = me and date = current_date and clock_out is null
  ) then
    raise exception 'you are already clocked in' using errcode = '23505';
  end if;

  insert into work.attendance (person_id, clock_in, date, note)
  values (me, now(), current_date, nullif(btrim(p_note), ''));
end;
$$;

-- RPC: clock out
create or replace function public.clock_out()
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  me uuid := identity.current_person_id();
begin
  if me is null then
    raise exception 'this account is not linked to a person' using errcode = '42501';
  end if;

  update work.attendance
     set clock_out = now()
   where person_id = me and date = current_date and clock_out is null;

  if not found then
    raise exception 'no active clock-in found for today' using errcode = '02000';
  end if;
end;
$$;

revoke all on function public.clock_in(text) from public;
revoke all on function public.clock_out() from public;
grant execute on function public.clock_in(text) to authenticated;
grant execute on function public.clock_out() to authenticated;
