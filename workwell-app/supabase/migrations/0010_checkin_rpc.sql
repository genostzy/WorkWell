-- Who am I. The app needs its own person row for greetings and to know
-- whether the account resolved to anybody at all.
create view public.me
  with (security_invoker = true)
  as select id, org_id, full_name, status
       from identity.people
      where auth_user_id = (select auth.uid());

grant select on public.me to authenticated;

-- Saving a check-in.
--
-- Deliberately an RPC rather than a table insert from the client. The
-- person_id is resolved server-side from the JWT, so the client never
-- names it and therefore cannot even attempt to write a row belonging to
-- someone else. The RLS policies on private.check_ins still stand behind
-- this as the second wall.
--
-- One row per person per day: a second submission amends the first, so
-- the history stays one row per day and trends never double-count.
create or replace function public.save_check_in(
  p_mood     smallint,
  p_energy   smallint,
  p_pressure smallint,
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

  -- An account with no person row is the designed outcome for an
  -- uninvited sign-in. Fail loudly rather than writing an orphan row.
  if me is null then
    raise exception 'this account is not linked to a person'
      using errcode = '42501';
  end if;

  insert into private.check_ins (person_id, day, mood, energy, pressure, note)
  values (me, current_date, p_mood, p_energy, p_pressure, nullif(btrim(p_note), ''))
  on conflict (person_id, day) do update
    set mood       = excluded.mood,
        energy     = excluded.energy,
        pressure   = excluded.pressure,
        note       = excluded.note,
        updated_at = now();
end;
$$;

revoke all on function public.save_check_in(smallint, smallint, smallint, text) from public;
grant execute on function public.save_check_in(smallint, smallint, smallint, text) to authenticated;
