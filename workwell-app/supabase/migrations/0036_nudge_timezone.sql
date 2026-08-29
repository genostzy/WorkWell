-- 0036: Per-person timezone for correct quiet-hours enforcement (fixes 0018 TODO).

alter table identity.people add column if not exists timezone text not null default 'Asia/Manila';
-- Validate IANA-ish: length check keeps column honest without an exhaustive list.
alter table identity.people drop constraint if exists people_timezone_check;
alter table identity.people add constraint people_timezone_check check (char_length(timezone) between 3 and 64);

-- Boundaries: add timezone override (defaults to person's timezone).
alter table private.boundaries add column if not exists timezone text;

-- Update emit_nudges to use person's timezone instead of hardcoded UTC.
create or replace function private.emit_nudges()
  returns int
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  r      record;
  chosen text;
  sent   int := 0;
  local_t time;
  wanted text[];
begin
  for r in
    select p.person_id, p.move, p.hydrate, p.breathe, p.step_away, p.daily_cap,
           coalesce(b.quiet_from, '18:30'::time) as quiet_from,
           coalesce(b.quiet_to,   '08:30'::time) as quiet_to,
           coalesce(b.timezone, pe.timezone, 'Asia/Manila') as tz
      from private.nudge_prefs p
      left join private.boundaries b on b.person_id = p.person_id
      join identity.people pe on pe.id = p.person_id
     where (p.muted_until is null or p.muted_until < current_date)
       and (p.move or p.hydrate or p.breathe or p.step_away)
       and (select count(*) from private.nudge_log l
            where l.person_id = p.person_id and l.sent_on = current_date) < p.daily_cap
  loop
    local_t := (now() at time zone r.tz)::time;
    if (r.quiet_from > r.quiet_to and (local_t >= r.quiet_from or local_t < r.quiet_to))
       or (r.quiet_from <= r.quiet_to and local_t >= r.quiet_from and local_t < r.quiet_to)
    then
      continue;
    end if;

    wanted := array[]::text[];
    if r.move      then wanted := array_append(wanted, 'move');      end if;
    if r.hydrate   then wanted := array_append(wanted, 'hydrate');   end if;
    if r.breathe   then wanted := array_append(wanted, 'breathe');   end if;
    if r.step_away then wanted := array_append(wanted, 'step_away'); end if;

    select k into chosen
      from unnest(wanted) as k
     where not exists (
       select 1 from private.nudge_log l
        where l.person_id = r.person_id
          and l.sent_on = current_date
          and l.kind = k)
     limit 1;

    if chosen is not null then
      insert into private.nudge_log (person_id, kind) values (r.person_id, chosen);
      sent := sent + 1;
    end if;
  end loop;
  return sent;
end;
$$;
