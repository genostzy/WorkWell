-- The private plane's first table: the daily mood check.
--
-- A note on the boundary. Until now `private` was closed to every API role,
-- which was cheap because the schema was empty. The employee is themselves
-- an `authenticated` user, so the moment they need to read their own
-- check-ins that blanket closure has to go. The guarantee was never
-- "nobody can enter the schema" — it is "nobody can read anyone else's
-- rows", and that is RLS's job. 11_private_plane.sql asserts the real
-- property directly: a second person, HR included, reads zero rows.
--
-- `work` and `org_agg` stay closed; they have no tables yet.

create table private.check_ins (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references identity.people(id) on delete cascade,
  -- One check-in per person per day. A second submission on the same day
  -- amends the first rather than stacking, so the history stays one row
  -- per day and trends never double-count.
  day         date not null default current_date,
  -- Every question is skippable per PRD F2, so all three are nullable.
  -- 1..5, where 5 is best for mood and energy, and 5 is the MOST pressure.
  mood        smallint check (mood     between 1 and 5),
  energy      smallint check (energy   between 1 and 5),
  pressure    smallint check (pressure between 1 and 5),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (person_id, day)
);

create index check_ins_person_day_idx
  on private.check_ins (person_id, day desc);

alter table private.check_ins enable row level security;

-- One policy shape for every verb. A read policy stricter than the write
-- policy would let someone write rows they cannot then see.
create policy check_ins_select on private.check_ins
  for select to authenticated
  using (person_id = identity.current_person_id());

create policy check_ins_insert on private.check_ins
  for insert to authenticated
  with check (person_id = identity.current_person_id());

create policy check_ins_update on private.check_ins
  for update to authenticated
  using (person_id = identity.current_person_id())
  with check (person_id = identity.current_person_id());

create policy check_ins_delete on private.check_ins
  for delete to authenticated
  using (person_id = identity.current_person_id());

grant usage on schema private to authenticated;
grant select, insert, update, delete on private.check_ins to authenticated;

-- PostgREST serves only `public`, so the app reads through a view.
-- security_invoker keeps the policies above in force for the caller.
create view public.check_ins
  with (security_invoker = true)
  as select id, person_id, day, mood, energy, pressure, note, created_at
       from private.check_ins;

grant select, insert, update, delete on public.check_ins to authenticated;
