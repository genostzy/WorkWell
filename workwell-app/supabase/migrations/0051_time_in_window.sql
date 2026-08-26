-- Enforce the time-in window where it can no longer be argued with.
--
-- The rule shipped in the client only: half an hour before the rostered
-- start, through to the rostered end. That was the honest choice at the
-- time -- a shift is a wall-clock pattern and the server had no idea whose
-- wall, so gating here would have compared in UTC and refused a Manila
-- employee at 3pm their time while the button in front of them said open.
-- 0050 gives the org a zone, so the two can now agree.
--
-- The client keeps its copy of the rule: a disabled button that explains
-- itself beats a live button that errors. This is the backstop, not the
-- explanation.
create or replace function public.attendance_time_in() returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  me         uuid := identity.current_person_id();
  tz         text;
  s          record;
  start_min  int;
  end_min    int;
  opens_at   int;
  window_len int;
  now_min    int;
  since_open int;
begin
  if me is null then
    raise exception 'this account is not linked to a person' using errcode = '42501';
  end if;

  select sh.time_in, sh.time_out
    into s
    from work.shift_assignments a
    join work.shifts sh on sh.id = a.shift_id
   where a.person_id = me;

  -- No roster is not a closed window: an account with no shift assigned has
  -- nothing to be early for, and always could time in whenever.
  if found then
    tz := identity.current_org_timezone();

    start_min := (extract(epoch from s.time_in) / 60)::int;
    end_min   := (extract(epoch from s.time_out) / 60)::int;
    now_min   := (extract(hour from now() at time zone tz)::int * 60)
               +  extract(minute from now() at time zone tz)::int;

    -- A shift ending on the clock minute it starts is a 24-hour shift, not a
    -- zero-minute one -- the same reading spanMinutes() takes in the client.
    opens_at   := (start_min - 30 + 1440) % 1440;
    window_len := 30 + case when end_min > start_min
                            then end_min - start_min
                            else end_min - start_min + 1440 end;
    since_open := ((now_min - opens_at) % 1440 + 1440) % 1440;

    if since_open > window_len then
      raise exception 'timing in for this shift opens at %',
        to_char(time '00:00' + (opens_at || ' minutes')::interval, 'HH12:MI am')
        using errcode = '42501';
    end if;
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
