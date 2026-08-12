-- Nudge delivery and the nightly aggregate refresh, both scheduled inside
-- the database.
--
-- The cap, the mute and the quiet-hours rule are enforced where the data
-- lives rather than trusted to a client. Neither job is reachable from an
-- HTTP request: both read private data in bulk, and that credential belongs
-- to the scheduler and nowhere else.
--
-- nudge_log exists to count against the cap, not to score anyone. PRD F3
-- refuses to optimise for acceptance, so nothing aggregates over `action`.
--
-- Known limit: times are compared in UTC. There is no per-person timezone
-- yet, so quiet hours mean UTC hours. That needs a timezone column on
-- identity.people before this is correct for a distributed team.
create extension if not exists pg_cron;

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
  loop
    -- Quiet hours wrap midnight when quiet_from > quiet_to.
    if (r.quiet_from > r.quiet_to and (now_t >= r.quiet_from or now_t < r.quiet_to))
       or (r.quiet_from <= r.quiet_to and now_t >= r.quiet_from and now_t < r.quiet_to)
    then
      continue;
    end if;

    -- Built as an array first. An earlier version chained `or` branches and
    -- appended `and not exists`, but `and` binds tighter than `or`, so the
    -- already-sent-today guard applied to only one branch and nothing was
    -- ever emitted. array_append rather than `||` because `array || 'move'`
    -- makes Postgres parse the string as an array literal.
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

select cron.schedule('emit-nudges', '0 * * * *', $$ select private.emit_nudges(); $$);
select cron.schedule('refresh-org-metrics', '15 2 * * *', $$ select org_agg.refresh(30); $$);

create view public.nudge_log with (security_invoker = true) as
  select id, person_id, kind, sent_on, action from private.nudge_log;

grant select, update on public.nudge_log to authenticated;
