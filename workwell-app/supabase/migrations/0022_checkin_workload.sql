-- The fourth question.
--
-- The prototype's check-in asks four things — mood, energy, pressure and
-- workload — and the port carried three. Workload is not a fourth flavour of
-- the same question: pressure is how it feels, workload is how much there
-- is, and the design says so on the screen ("this is about the amount of
-- work — not how well you're coping"). Separating them is the whole point,
-- because the org plane is supposed to surface structural load rather than
-- who is struggling with it.
--
-- Nullable like the other three: every question is skippable per the PRD,
-- and "I would rather not say" must stay distinguishable from the middle of
-- the scale.

alter table private.check_ins
  add column workload smallint check (workload between 1 and 5);

-- The signature changes, so the old one is dropped rather than left as an
-- overload. Two functions differing only by arity is how a client ends up
-- silently calling the version that quietly discards an answer.
drop function if exists public.save_check_in(smallint, smallint, smallint, text);

create function public.save_check_in(
  p_mood     smallint,
  p_energy   smallint,
  p_pressure smallint,
  p_workload smallint,
  p_note     text
) returns void
language plpgsql
security definer
set search_path to ''
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
     nullif(btrim(p_note), ''))
  on conflict (person_id, day) do update
    set mood       = excluded.mood,
        energy     = excluded.energy,
        pressure   = excluded.pressure,
        workload   = excluded.workload,
        note       = excluded.note,
        updated_at = now();
end;
$$;

revoke all on function public.save_check_in(smallint, smallint, smallint, smallint, text) from public;
grant execute on function public.save_check_in(smallint, smallint, smallint, smallint, text) to authenticated;

-- The view is what the client reads, so it has to carry the new column too.
-- `create or replace view` may only append columns — it cannot reorder or
-- drop them — so workload goes on the end rather than beside its siblings.
-- Rebuilding the view to get a tidier column order would mean dropping it,
-- and dropping it drops its grants with it.
create or replace view public.check_ins with (security_invoker = true) as
  select id, person_id, day, mood, energy, pressure, note, created_at, workload
    from private.check_ins;
