-- "What ate your day?" -- an optional, multi-select tag on a check-in,
-- answered after the timed four-question flow is already saved, not as a
-- fifth question inside it. F2 is explicit that the check-in itself
-- completes in 10 seconds; this stays off that clock entirely; the client
-- writes it as a follow-up update once the person is looking at the
-- "Saved" screen; the RPC that saves the timed questions is otherwise
-- unchanged.
--
-- Fully private, same as mood/energy/pressure/workload: no HR read path
-- exists or is added here.

alter table private.check_ins
  add column day_eaten_by text[]
    check (day_eaten_by <@ array['meetings', 'deep_work', 'interruptions', 'admin']::text[]);

-- No new RLS policy needed: check_ins_update (0009) already lets a person
-- update their own row by id, and this column is reached the same way any
-- other column on this table already is.

-- save_check_in returns void today; the client needs the new row's id back
-- to target the follow-up tags update, so this drops and recreates it with
-- a uuid return -- create or replace cannot change a function's return
-- type. Parameters are unchanged.
drop function public.save_check_in(smallint, smallint, smallint, smallint, text);

create function public.save_check_in(
  p_mood     smallint,
  p_energy   smallint,
  p_pressure smallint,
  p_workload smallint,
  p_note     text
) returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  me uuid;
  new_id uuid;
begin
  me := identity.current_person_id();

  if me is null then
    raise exception 'this account is not linked to a person'
      using errcode = '42501';
  end if;

  insert into private.check_ins
    (person_id, day, mood, energy, pressure, workload, note)
  values
    (me, current_date, p_mood, p_energy, p_pressure, p_workload,
     nullif(btrim(p_note), ''))
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.save_check_in(smallint, smallint, smallint, smallint, text) from public;
grant execute on function public.save_check_in(smallint, smallint, smallint, smallint, text) to authenticated;

-- Appended after every existing column, workload included -- create or
-- replace view cannot reorder or rename existing columns, only append,
-- same rule 0022 and 0056 both already followed here.
create or replace view public.check_ins
  with (security_invoker = true)
  as select id, person_id, day, mood, energy, pressure, note, created_at,
            workload, day_eaten_by
       from private.check_ins;

notify pgrst, 'reload schema';
