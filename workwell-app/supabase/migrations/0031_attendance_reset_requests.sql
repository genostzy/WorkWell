-- Attendance is self-only by design (0027) -- HR has no read, no write, no
-- policy reaching it at all. This adds the one deliberate exception: a
-- person can ask HR to fix a specific day, with a reason, and HR's access
-- to that one day's record exists only while that request is open. The
-- same shape as support_requests' "route to hr" exception in
-- 0017_support_features.sql, applied to attendance instead of a support
-- message.
--
-- Writes stay RPC-only, same convention 0027/0029 already established for
-- anything on this table: no insert/update grant to authenticated at all,
-- so there is no second door to remember to lock.

create table private.attendance_reset_requests (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references identity.people(id) on delete cascade,
  day        date not null,
  reason     text not null check (btrim(reason) <> ''),
  status     text not null default 'pending'
             check (status in ('pending', 'approved', 'declined', 'withdrawn')),
  decided_by uuid references identity.people(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index attendance_reset_person_idx on private.attendance_reset_requests (person_id, created_at desc);
create index attendance_reset_status_idx on private.attendance_reset_requests (status);

-- One request at a time per day -- a second request for the same day
-- waits for the first to be decided (or withdrawn) rather than stacking.
create unique index attendance_reset_pending_uniq
  on private.attendance_reset_requests (person_id, day)
  where status = 'pending';

alter table private.attendance_reset_requests enable row level security;

-- Yours, or HR's for their own org -- an audit trail, same as leave, not a
-- disclosure that disappears once decided the way a support request does.
create policy attendance_reset_select on private.attendance_reset_requests
  for select to authenticated
  using (
    person_id = identity.current_person_id()
    or (identity.is_hr() and identity.same_org(person_id))
  );

grant select on private.attendance_reset_requests to authenticated;

-- The one exception to attendance's own "nobody but you, ever" policy:
-- HR may read a specific day's record only while a pending request for
-- that exact person and day exists. Approve, decline, or withdraw it and
-- the door closes again -- this policy stops matching the moment
-- status is no longer 'pending'.
create policy attendance_hr_review on private.attendance
  for select to authenticated
  using (
    identity.is_hr()
    and identity.same_org(person_id)
    and exists (
      select 1 from private.attendance_reset_requests r
       where r.person_id = attendance.person_id
         and r.day = attendance.day
         and r.status = 'pending'
    )
  );

-- Supabase's default privileges grant authenticated more than the above
-- regardless of what's explicitly granted (see 0028) -- close it the same
-- way rather than relying on RLS alone.
revoke insert, update, delete, truncate, references, trigger
  on private.attendance_reset_requests from authenticated, anon;

create view public.attendance_reset_requests
  with (security_invoker = true)
  as select id, person_id, day, reason, status, decided_by, decided_at, created_at
       from private.attendance_reset_requests;

grant select on public.attendance_reset_requests to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.attendance_reset_requests from authenticated, anon;

-- ------------------------------------------------------------------- RPCs

create function public.request_attendance_reset(p_day date, p_reason text)
  returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  me     uuid := identity.current_person_id();
  new_id uuid;
begin
  if me is null then
    raise exception 'this account is not linked to a person' using errcode = '42501';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'a reason is required' using errcode = '23514';
  end if;

  insert into private.attendance_reset_requests (person_id, day, reason)
  values (me, p_day, btrim(p_reason))
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.request_attendance_reset(date, text) from public;
grant execute on function public.request_attendance_reset(date, text) to authenticated;

create function public.withdraw_attendance_reset(p_id uuid) returns void
language plpgsql
security definer
set search_path to ''
as $$
declare me uuid := identity.current_person_id();
begin
  if me is null then
    raise exception 'this account is not linked to a person' using errcode = '42501';
  end if;

  update private.attendance_reset_requests
     set status = 'withdrawn'
   where id = p_id and person_id = me and status = 'pending';
end;
$$;

revoke all on function public.withdraw_attendance_reset(uuid) from public;
grant execute on function public.withdraw_attendance_reset(uuid) to authenticated;

-- HR's decision. Approving writes the corrected times directly -- this is
-- the one path in the product where anyone other than the person
-- themselves can write to private.attendance, and it exists only for the
-- single day named in an open request the person raised themselves, with
-- a reason, of their own choosing.
create function public.decide_attendance_reset(
  p_id          uuid,
  p_approve     boolean,
  p_time_in     timestamptz default null,
  p_lunch_start timestamptz default null,
  p_lunch_end   timestamptz default null,
  p_time_out    timestamptz default null
) returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  me  uuid := identity.current_person_id();
  req private.attendance_reset_requests%rowtype;
begin
  if me is null or not identity.is_hr() then
    raise exception 'only HR can decide a reset request' using errcode = '42501';
  end if;

  select * into req from private.attendance_reset_requests where id = p_id for update;
  if not found then
    raise exception 'no such request' using errcode = '02000';
  end if;
  if not identity.same_org(req.person_id) then
    raise exception 'that request is not at your organisation' using errcode = '42501';
  end if;
  if req.status <> 'pending' then
    raise exception 'that request has already been decided' using errcode = '42501';
  end if;

  if p_approve then
    insert into private.attendance (person_id, day, time_in, lunch_start, lunch_end, time_out)
    values (req.person_id, req.day, p_time_in, p_lunch_start, p_lunch_end, p_time_out)
    on conflict (person_id, day) do update
      set time_in     = excluded.time_in,
          lunch_start = excluded.lunch_start,
          lunch_end   = excluded.lunch_end,
          time_out    = excluded.time_out,
          updated_at  = now();
  end if;

  update private.attendance_reset_requests
     set status     = case when p_approve then 'approved' else 'declined' end,
         decided_by = me,
         decided_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.decide_attendance_reset(uuid, boolean, timestamptz, timestamptz, timestamptz, timestamptz) from public;
grant execute on function public.decide_attendance_reset(uuid, boolean, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
