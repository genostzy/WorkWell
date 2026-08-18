-- Real persistence for time in / time out, replacing the client-only mock.
--
-- Mirrors 0009_private_checkins.sql's shape closely: private schema, one row
-- per person per day, RLS keyed on identity.current_person_id(). The
-- difference is that nothing here is meant for direct client writes — every
-- column changes through one of the four RPCs below, each guarded so a
-- repeated call (the lunch auto-pause tick fires every 30s) never
-- overwrites a timestamp already set. So unlike check_ins, `authenticated`
-- gets SELECT on the view only; insert/update live entirely behind the
-- security-definer functions.

create table private.attendance (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references identity.people(id) on delete cascade,
  day         date not null default current_date,
  time_in     timestamptz,
  lunch_start timestamptz,
  lunch_end   timestamptz,
  time_out    timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (person_id, day)
);

create index attendance_person_day_idx
  on private.attendance (person_id, day desc);

alter table private.attendance enable row level security;

create policy attendance_select on private.attendance
  for select to authenticated
  using (person_id = identity.current_person_id());

-- No insert/update/delete policies: the RPCs are security definer and
-- write to the table directly, so RLS on this table only ever gates
-- reads. A stray insert/update policy here would just be an unused
-- second door that isn't actually needed.

grant select on private.attendance to authenticated;

create view public.attendance
  with (security_invoker = true)
  as select id, person_id, day, time_in, lunch_start, lunch_end, time_out, created_at
       from private.attendance;

grant select on public.attendance to authenticated;

-- ------------------------------------------------------------------- RPCs

create function public.attendance_time_in() returns void
language plpgsql
security definer
set search_path to ''
as $$
declare me uuid := identity.current_person_id();
begin
  if me is null then
    raise exception 'this account is not linked to a person' using errcode = '42501';
  end if;

  insert into private.attendance (person_id, day, time_in)
  values (me, current_date, now())
  on conflict (person_id, day) do update
    -- coalesce, not overwrite: a repeated call must not push time_in later.
    set time_in = coalesce(private.attendance.time_in, excluded.time_in),
        updated_at = now();
end;
$$;

revoke all on function public.attendance_time_in() from public;
grant execute on function public.attendance_time_in() to authenticated;

create function public.attendance_lunch_start() returns void
language plpgsql
security definer
set search_path to ''
as $$
declare me uuid := identity.current_person_id();
begin
  if me is null then
    raise exception 'this account is not linked to a person' using errcode = '42501';
  end if;

  update private.attendance
     set lunch_start = now(), updated_at = now()
   where person_id = me and day = current_date
     and time_in is not null and lunch_start is null and time_out is null;
end;
$$;

revoke all on function public.attendance_lunch_start() from public;
grant execute on function public.attendance_lunch_start() to authenticated;

create function public.attendance_lunch_end() returns void
language plpgsql
security definer
set search_path to ''
as $$
declare me uuid := identity.current_person_id();
begin
  if me is null then
    raise exception 'this account is not linked to a person' using errcode = '42501';
  end if;

  update private.attendance
     set lunch_end = now(), updated_at = now()
   where person_id = me and day = current_date
     and lunch_start is not null and lunch_end is null and time_out is null;
end;
$$;

revoke all on function public.attendance_lunch_end() from public;
grant execute on function public.attendance_lunch_end() to authenticated;

create function public.attendance_time_out() returns void
language plpgsql
security definer
set search_path to ''
as $$
declare me uuid := identity.current_person_id();
begin
  if me is null then
    raise exception 'this account is not linked to a person' using errcode = '42501';
  end if;

  update private.attendance
     set time_out = now(), updated_at = now()
   where person_id = me and day = current_date
     and time_in is not null and time_out is null;
end;
$$;

revoke all on function public.attendance_time_out() from public;
grant execute on function public.attendance_time_out() to authenticated;
