-- Demo data for Structural load: 9 Engineering employees with recent
-- check-ins, so a fresh project (or a reset one) shows a real,
-- unsuppressed cohort instead of "no groups yet" the first time someone
-- opens that screen. Without this, the 8-person floor is invisible in a
-- demo -- correct, but nothing to show for it.
--
-- Fixed ids and on-conflict-do-nothing throughout, so this is safe to
-- apply more than once: reapplying it (or running it against a project
-- that already has this seed) changes nothing.
--
-- Values are deterministic, not random(), so the same migration produces
-- the same numbers every time it lands on a fresh project -- a seed that
-- gives a different demo each run is a worse seed.

insert into identity.people (id, org_id, auth_user_id, email, full_name, status, must_change_password)
select
  ('c0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  null,
  'seed.employee' || n || '@workwell.test',
  'Test Employee ' || n,
  'active',
  true
from generate_series(1, 9) as n
on conflict (id) do nothing;

insert into identity.person_roles (person_id, role)
select ('c0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'employee'
from generate_series(1, 9) as n
on conflict do nothing;

insert into work.employment (person_id, job_title, department, started_on)
select
  ('c0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'Software Engineer',
  'Engineering',
  (current_date - 200)::date
from generate_series(1, 9) as n
on conflict (person_id) do nothing;

-- A handful of recent check-ins per person, spread over the last week,
-- values cycling deterministically across the 1-5 scale rather than
-- fixed to one number -- a flat 3.0 average everywhere reads as fake in
-- a way a slightly uneven one does not.
insert into private.check_ins (person_id, day, mood, energy, pressure, workload)
select
  ('c0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  (current_date - g)::date,
  2 + ((n + g) % 4),
  2 + ((n + g + 1) % 4),
  2 + ((n + g + 2) % 4),
  2 + ((n + g + 3) % 4)
from generate_series(1, 9) as n
cross join generate_series(0, 6, 2) as g
on conflict (person_id, day) do nothing;

-- Two of the nine have quietly raised a team signal, so Structural load's
-- "Team concern raised" figure demos as a real, nonzero share (2 of 9)
-- instead of a wall of zeros -- the feature working is more convincing
-- than the feature merely existing.
insert into private.team_signals (person_id)
select ('c0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
from generate_series(1, 2) as n
where not exists (
  select 1 from private.team_signals ts
   where ts.person_id = ('c0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
);

-- Populate the aggregate tables immediately, so the demo doesn't depend
-- on someone remembering to refresh after this migration runs.
select org_agg.refresh(30);
