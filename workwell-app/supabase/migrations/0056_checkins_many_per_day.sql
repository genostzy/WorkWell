-- More than one check-in a day.
--
-- The table has carried a unique (person_id, day) since 0009, and
-- save_check_in upserted onto it: going through the questions a second
-- time silently rewrote the morning's answers. That is the wrong shape for
-- what a check-in is. A day is not one mood — somebody who was flat before
-- a meeting and fine after it recorded two true things, and the second
-- should not delete the first.
--
-- Nothing aggregated downstream breaks on this. org_agg.refresh counts
-- distinct people and averages the values, so a day with three entries
-- weighs its own three answers and still counts as one person; the
-- suppression floor it applies is a headcount, not a row count.

alter table private.check_ins
  drop constraint check_ins_person_id_day_key;

-- No new index. check_ins_person_day_idx already exists from 0009 as
-- (person_id, day desc), which is exactly the read this changes — a day
-- now returns a list instead of at most one row, and that index still
-- finds it. The unique index behind the dropped constraint goes with it.

/**
 * Record a check-in. Always a new one.
 *
 * Was an upsert on (person_id, day). With that constraint gone there is
 * nothing left to conflict on, and nothing that should: every pass through
 * the questions is its own answer, at its own time of day.
 */
create or replace function public.save_check_in(
  p_mood     smallint,
  p_energy   smallint,
  p_pressure smallint,
  p_workload smallint,
  p_note     text
) returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  me uuid;
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
     nullif(btrim(p_note), ''));
end;
$$;

-- public.check_ins is deliberately left alone. It already exposes id and
-- created_at, which is everything a reader needs to tell two entries on the
-- same day apart and order them within it — and create or replace view
-- cannot reorder or rename existing columns, only append, so rewriting it
-- to a tidier column order would fail outright.

notify pgrst, 'reload schema';
