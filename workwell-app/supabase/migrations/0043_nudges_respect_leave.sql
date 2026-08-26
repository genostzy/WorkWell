-- Nudges' own copy claims "Time off & leave" is not a preference but
-- something the product always enforces — a fixed "Always" chip, no toggle,
-- sitting right next to the real preferences. private.emit_nudges() never
-- checked it: the only thing it ever gated on was quiet hours. Approved
-- leave already exists as data (work.leave_requests); this makes the one
-- enforced item on that list actually true for the one case this schema can
-- support. "Out of office", "Focus time" and "Meetings" stay unenforced —
-- there is no calendar or meeting model anywhere in the product to check
-- against, the same gap Boundaries' own Focus protection section already
-- discloses.
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
  now_t  time := (now() at time zone 'utc')::time;
  wanted text[];
begin
  for r in
    select p.person_id, p.move, p.hydrate, p.breathe, p.step_away, p.daily_cap,
           coalesce(b.quiet_from, '18:30'::time) as quiet_from,
           coalesce(b.quiet_to,   '08:30'::time) as quiet_to
      from private.nudge_prefs p
      left join private.boundaries b on b.person_id = p.person_id
     where (p.muted_until is null or p.muted_until < current_date)
       and (p.move or p.hydrate or p.breathe or p.step_away)
       and (select count(*) from private.nudge_log l
             where l.person_id = p.person_id and l.sent_on = current_date) < p.daily_cap
       and not exists (
         select 1 from work.leave_requests lr
          where lr.person_id = p.person_id
            and lr.status = 'approved'
            and current_date between lr.starts_on and lr.ends_on
       )
  loop
    -- Quiet hours wrap midnight when quiet_from > quiet_to.
    if (r.quiet_from > r.quiet_to and (now_t >= r.quiet_from or now_t < r.quiet_to))
       or (r.quiet_from <= r.quiet_to and now_t >= r.quiet_from and now_t < r.quiet_to)
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

revoke all on function private.emit_nudges() from public;
