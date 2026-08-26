-- Nudges read the office clock, not UTC.
--
-- This closes the gap 0018_scheduler.sql opened with its own comment:
-- "Known limit: times are compared in UTC. There is no per-person timezone
-- yet, so quiet hours mean UTC hours." For the demo org that is eight hours
-- out, which does not merely misalign the feature — it inverts it. Quiet
-- hours of 18:30–08:30 evaluated against UTC are 02:30–16:30 in Manila, so
-- the job stayed silent through the working day and nudged people all
-- evening: precisely the hours the boundary assistant exists to protect.
--
-- 0050 gives the org a zone, so the wall clock is now answerable. The zone
-- is read per row rather than once for the whole run: the job sweeps every
-- org there is, and they do not share a midnight.
--
-- Deliberately unchanged: nudge_log.sent_on and the daily-cap count still
-- turn over on the UTC date. That is a different question — how many have
-- been sent in an accounting day, not whether right now is a quiet hour —
-- and moving it would shift when everyone's cap resets. Worth doing on
-- purpose, not as a side effect of this.
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
  now_t  time;
  wanted text[];
begin
  for r in
    select p.person_id, p.move, p.hydrate, p.breathe, p.step_away, p.daily_cap,
           coalesce(b.quiet_from, '18:30'::time) as quiet_from,
           coalesce(b.quiet_to,   '08:30'::time) as quiet_to,
           coalesce(o.timezone, 'UTC')           as tz
      from private.nudge_prefs p
      join identity.people pe on pe.id = p.person_id
      left join identity.orgs o on o.id = pe.org_id
      left join private.boundaries b on b.person_id = p.person_id
     where (p.muted_until is null or p.muted_until < current_date)
       and (p.move or p.hydrate or p.breathe or p.step_away)
       and (select count(*) from private.nudge_log l
             where l.person_id = p.person_id and l.sent_on = current_date) < p.daily_cap
       -- Leave is a calendar fact at the workplace, so it is asked in the
       -- workplace's own day. Against the UTC date, the first morning of
       -- someone's leave still nudged them until the office reached 08:00.
       and not exists (
         select 1 from work.leave_requests lr
          where lr.person_id = p.person_id
            and lr.status = 'approved'
            and (now() at time zone coalesce(o.timezone, 'UTC'))::date
                between lr.starts_on and lr.ends_on
       )
  loop
    -- Per row: two orgs in different zones are in quiet hours at different
    -- moments, and one `now` for the whole sweep cannot say that.
    now_t := (now() at time zone r.tz)::time;

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
