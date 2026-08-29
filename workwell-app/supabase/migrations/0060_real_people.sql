-- The directory, restaffed.
--
-- Out go the nine "Test Employee N" rows and the twelve invented names
-- from 0059; in go eighteen real ones, with the two accounts that can
-- actually sign in left untouched.
--
-- Deleting a person is a cascade across roughly twenty tables (every
-- person_id foreign key in the schema is `on delete cascade`, and every
-- decided_by / issued_by / assigned_by / manager_id is `on delete set
-- null`), which is exactly what makes it safe to do in one statement: a
-- removed person leaves no orphan rows behind, and the records of people
-- who stay keep their shape with a null where the departed used to be.
-- Checked before running: nothing belonging to either keeper pointed at
-- anybody being removed.
--
-- Everyone here is written out rather than generated, for 0059's reason:
-- a migration that calls random() produces a different database every
-- time it runs. The check-ins at the bottom are the one exception and are
-- derived arithmetically from a fixed per-person baseline, so they are
-- still the same numbers on every run.

-- ------------------------------------------------------------- Clear out
--
-- Scoped to the org and to everyone who is not one of the two real
-- accounts. Big Boss is HR and Celine is the OJT manager; both have an
-- auth user behind them, and neither is replaceable by a seed row.

delete from identity.people
 where org_id = 'a0000000-0000-0000-0000-000000000001'
   and id not in (
     '58559faa-4c4e-479c-8e09-46aa52acf374',  -- Big Boss (HR)
     '43b372c1-8d91-4fdb-b9c3-974d774a7e34'   -- Celine Nolasco
   );

-- ---------------------------------------------------------------- People
--
-- No auth users, as in 0059: auth_user_id stays null, so these rows fill
-- the directory, hold an employment record and can be given work, and
-- nobody can sign in as them. Accounts are HR's to create through
-- invite_person(), not a migration's.

insert into identity.people (id, org_id, email, full_name, status) values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'lincoln.velasquez@workwell.com',        'Lincoln Velasquez',           'active'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'viy.cortez@workwell.com',               'Viy Cortez',                  'active'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'marlon.velasquez@workwell.com',         'Marlon Velasquez',            'active'),
  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'vien.iligan@workwell.com',              'Vien Iligan',                 'active'),
  ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'exekiel.gaspar@workwell.com',           'Exekiel Christian Gaspar',    'active'),
  ('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'patricia.velasquez.gaspar@workwell.com','Patricia Velasquez-Gaspar',   'active'),
  ('e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'anthonyjay.andrada@workwell.com',       'Anthony Jay Andrada',         'active'),
  ('e0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'jaime.deguzman@workwell.com',           'Jaime Marino De Guzman',      'active'),
  ('e0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'aaron.macacua@workwell.com',            'Aaron Macacua',               'active'),
  ('e0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'michael.magnata@workwell.com',          'Michael Magnata',             'active'),
  ('e0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000001', 'marvin.velasquez2@workwell.com',        'Marvin Velasquez II',         'active'),
  ('e0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000001', 'pau.sepagan@workwell.com',              'Pau Sepagan',                 'active'),
  ('e0000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-000000000001', 'carlos.magnata@workwell.com',           'Carlos Magnata',              'active'),
  ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-000000000001', 'kevin.hermosada@workwell.com',          'Kevin Hermosada',             'active'),
  ('e0000000-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001', 'awi.columna@workwell.com',              'Awi Columna',                 'active'),
  ('e0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'carding.magsino@workwell.com',          'Carding Magsino',             'active'),
  ('e0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'kuya.inday@workwell.com',               'Kuya Inday',                  'active'),
  ('e0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'emman.nimedez@workwell.com',            'Emman Nimedez',               'active');

insert into identity.person_roles (person_id, role)
select id, 'employee' from identity.people
 where id::text like 'e0000000-%';

-- ------------------------------------------------------------ Employment
--
-- Written as an org rather than as eighteen unrelated rows: four
-- departments with a lead at the top of each, managers pointing at people
-- who really are above them, and a tenure spread that runs from eleven
-- years to a fortnight. Two Magnatas in the same team on purpose, and two
-- more Velasquezes elsewhere — a directory where every surname is unique
-- is a directory nobody has ever worked in.
--
-- Leads are inserted first so the manager_id references below them
-- resolve. Entitlement tracks tenure and contract, the way it would if
-- somebody had actually been keeping it.

insert into work.employment
  (person_id, job_title, department, team, manager_id, contract_type, location, started_on, entitlement)
values
  -- The four people nobody reports through
  ('e0000000-0000-0000-0000-000000000010', 'Facilities Technician',    'Maintenance', 'Grounds',      null, 'Full time', 'Manila',    date '2015-03-02', 26),
  ('e0000000-0000-0000-0000-000000000006', 'Finance Lead',             'Finance',     'Payroll',      null, 'Full time', 'Manila',    date '2017-05-15', 25),
  ('e0000000-0000-0000-0000-000000000001', 'Operations Manager',       'Operations',  'Service desk', null, 'Full time', 'Manila',    date '2018-01-08', 25),
  ('e0000000-0000-0000-0000-000000000003', 'Systems Administrator',    'Engineering', 'Platform',     null, 'Full time', 'Manila',    date '2019-09-02', 22),
  ('e0000000-0000-0000-0000-000000000002', 'People Partner',           'People',      'Hiring',       null, 'Full time', 'Manila',    date '2020-02-17', 24);

insert into work.employment
  (person_id, job_title, department, team, manager_id, contract_type, location, started_on, entitlement)
values
  -- Operations
  ('e0000000-0000-0000-0000-000000000004', 'Dispatch Coordinator',     'Operations',  'Dispatch',     'e0000000-0000-0000-0000-000000000001', 'Full time',    'Cebu City', date '2021-06-14', 20),
  ('e0000000-0000-0000-0000-00000000000c', 'Customer Care Agent',      'Operations',  'Service desk', 'e0000000-0000-0000-0000-000000000004', 'Full time',    'Manila',    date '2024-02-19', 20),
  ('e0000000-0000-0000-0000-00000000000f', 'Customer Care Agent',      'Operations',  'Service desk', 'e0000000-0000-0000-0000-000000000004', 'Probationary', 'Remote',    date '2026-08-17', 10),

  -- Engineering
  ('e0000000-0000-0000-0000-000000000012', 'Frontend Developer',       'Engineering', 'Platform',     'e0000000-0000-0000-0000-000000000003', 'Full time',    'Manila',    date '2021-01-11', 22),
  ('e0000000-0000-0000-0000-000000000005', 'Backend Developer',        'Engineering', 'Platform',     'e0000000-0000-0000-0000-000000000003', 'Full time',    'Remote',    date '2022-03-21', 20),
  ('e0000000-0000-0000-0000-000000000009', 'QA Engineer',              'Engineering', 'Quality',      'e0000000-0000-0000-0000-000000000003', 'Full time',    'Cebu City', date '2023-08-07', 20),
  ('e0000000-0000-0000-0000-00000000000e', 'Junior Developer',         'Engineering', 'Platform',     'e0000000-0000-0000-0000-000000000005', 'Probationary', 'Remote',    date '2026-06-15', 15),

  -- Finance
  ('e0000000-0000-0000-0000-00000000000a', 'Payroll Officer',          'Finance',     'Payroll',      'e0000000-0000-0000-0000-000000000006', 'Full time',    'Manila',    date '2020-10-05', 22),
  ('e0000000-0000-0000-0000-00000000000d', 'Accounts Assistant',       'Finance',     'Payroll',      'e0000000-0000-0000-0000-00000000000a', 'Part time',    'Manila',    date '2024-07-01', 12),

  -- People
  ('e0000000-0000-0000-0000-000000000007', 'Recruitment Officer',      'People',      'Hiring',       'e0000000-0000-0000-0000-000000000002', 'Full time',    'Manila',    date '2023-11-13', 20),
  ('e0000000-0000-0000-0000-00000000000b', 'HR Intern',                'People',      'Hiring',       'e0000000-0000-0000-0000-000000000007', 'Intern',       'Manila',    date '2026-07-06',  5),

  -- Maintenance
  ('e0000000-0000-0000-0000-000000000008', 'Security Officer',         'Maintenance', 'Night watch',  'e0000000-0000-0000-0000-000000000010', 'Full time',    'Manila',    date '2019-11-25', 20),

  -- Logistics. One department, one person, and everybody knows where she is.
  ('e0000000-0000-0000-0000-000000000011', 'Pantry & Supplies Custodian', 'Logistics', 'Stores',      null, 'Full time', 'Manila', date '2016-08-15', 24);

-- ------------------------------------------------------------------ Work
--
-- A handful of assigned tasks so the boards are not empty. Set by Big
-- Boss, because assigned_by has to be somebody with HR, and written the
-- way tasks actually get written: half of them chores, one of them
-- somebody's third reminder, and due dates that have already been and
-- gone.

insert into work.assigned_tasks (person_id, title, note, due_on, done_at, assigned_by) values
  ('e0000000-0000-0000-0000-00000000000e', 'Finish onboarding checklist', 'Probation review is in September and this is the third ask.', current_date - 4, null, '58559faa-4c4e-479c-8e09-46aa52acf374'),
  ('e0000000-0000-0000-0000-00000000000b', 'Read the leave policy properly', 'All of it. There will be questions.', current_date + 3, null, '58559faa-4c4e-479c-8e09-46aa52acf374'),
  ('e0000000-0000-0000-0000-000000000011', 'Reorder pantry supplies', 'The good coffee, not the other one.', current_date + 1, null, '58559faa-4c4e-479c-8e09-46aa52acf374'),
  ('e0000000-0000-0000-0000-000000000010', 'Fix the second-floor aircon', 'Reported four times. Engineering are threatening to work from home permanently.', current_date - 1, null, '58559faa-4c4e-479c-8e09-46aa52acf374'),
  ('e0000000-0000-0000-0000-000000000008', 'Log the night walkthrough', 'Nightly, before 2am.', current_date, null, '58559faa-4c4e-479c-8e09-46aa52acf374'),
  ('e0000000-0000-0000-0000-00000000000d', 'Reconcile July petty cash', 'The receipts drawer, not the spreadsheet.', current_date + 5, null, '58559faa-4c4e-479c-8e09-46aa52acf374'),
  ('e0000000-0000-0000-0000-000000000009', 'Regression pass before release', null, current_date + 2, null, '58559faa-4c4e-479c-8e09-46aa52acf374'),
  ('e0000000-0000-0000-0000-00000000000f', 'Shadow the service desk for a week', 'Sit with Pau. Ask everything.', current_date + 7, null, '58559faa-4c4e-479c-8e09-46aa52acf374'),
  ('e0000000-0000-0000-0000-000000000005', 'Write up the outage', 'Two paragraphs is fine. It has been a month.', current_date - 9, null, '58559faa-4c4e-479c-8e09-46aa52acf374'),
  ('e0000000-0000-0000-0000-000000000004', 'Confirm the Cebu roster', null, current_date - 6, now() - interval '5 days', '58559faa-4c4e-479c-8e09-46aa52acf374'),
  ('e0000000-0000-0000-0000-000000000007', 'Close out the two open roles', null, current_date - 2, now() - interval '1 day', '58559faa-4c4e-479c-8e09-46aa52acf374'),
  ('e0000000-0000-0000-0000-000000000012', 'Update the design tokens', null, current_date - 12, now() - interval '11 days', '58559faa-4c4e-479c-8e09-46aa52acf374');

-- ------------------------------------------------------------- Check-ins
--
-- Private-plane data, seeded for one reason: the organisation screen
-- suppresses any cohort under eight people, so with an empty check-in
-- table it shows nothing at all and cannot be looked at. The delete above
-- took 36 rows with it, and this puts a fortnight back.
--
-- Derived, not random. Each person has a fixed baseline — the night-shift
-- security officer runs tired, the two probationers run anxious, the
-- eleven-year facilities technician is unbothered by anything — and the
-- day-to-day wobble comes from fixed arrays indexed by person and day, so
-- every run of this migration produces exactly the same numbers.
--
-- Weekends are skipped, and so is roughly one weekday in five, because a
-- table where all eighteen people check in every single working day is
-- the one shape a real one never has.

insert into private.check_ins (person_id, day, mood, energy, pressure, workload, created_at)
select b.person_id,
       current_date - d,
       greatest(1, least(5, b.mood     + j.m)),
       greatest(1, least(5, b.energy   + j.e)),
       greatest(1, least(5, b.pressure + j.p)),
       greatest(1, least(5, b.workload + j.w)),
       (current_date - d) + time '09:05' + (b.ord * interval '7 minutes')
  from (values
    -- person                                  ord  mood energy pressure workload
    ('e0000000-0000-0000-0000-000000000001'::uuid, 1,  4,  3,  4,  4),  -- Lincoln, runs the floor
    ('e0000000-0000-0000-0000-000000000002'::uuid, 2,  4,  4,  3,  3),  -- Viy
    ('e0000000-0000-0000-0000-000000000003'::uuid, 3,  3,  3,  4,  4),  -- Marlon, on call
    ('e0000000-0000-0000-0000-000000000004'::uuid, 4,  4,  4,  3,  4),  -- Vien
    ('e0000000-0000-0000-0000-000000000005'::uuid, 5,  4,  3,  3,  4),  -- Exekiel
    ('e0000000-0000-0000-0000-000000000006'::uuid, 6,  4,  4,  4,  4),  -- Patricia, month-end
    ('e0000000-0000-0000-0000-000000000007'::uuid, 7,  4,  4,  3,  3),  -- Anthony Jay
    ('e0000000-0000-0000-0000-000000000008'::uuid, 8,  3,  2,  3,  3),  -- Jaime, nights
    ('e0000000-0000-0000-0000-000000000009'::uuid, 9,  4,  4,  3,  4),  -- Aaron
    ('e0000000-0000-0000-0000-00000000000a'::uuid, 10, 3,  3,  4,  4),  -- Michael, payroll week
    ('e0000000-0000-0000-0000-00000000000b'::uuid, 11, 5,  5,  2,  2),  -- Marvin II, intern, delighted
    ('e0000000-0000-0000-0000-00000000000c'::uuid, 12, 3,  3,  4,  4),  -- Pau, service desk
    ('e0000000-0000-0000-0000-00000000000d'::uuid, 13, 4,  4,  2,  2),  -- Carlos, part time
    ('e0000000-0000-0000-0000-00000000000e'::uuid, 14, 3,  4,  4,  3),  -- Kevin, probation
    ('e0000000-0000-0000-0000-00000000000f'::uuid, 15, 3,  4,  4,  3),  -- Awi, two weeks in
    ('e0000000-0000-0000-0000-000000000010'::uuid, 16, 5,  4,  2,  3),  -- Carding, eleven years, unbothered
    ('e0000000-0000-0000-0000-000000000011'::uuid, 17, 5,  4,  2,  3),  -- Kuya Inday
    ('e0000000-0000-0000-0000-000000000012'::uuid, 18, 4,  3,  3,  4)   -- Emman
  ) as b(person_id, ord, mood, energy, pressure, workload)
 cross join generate_series(0, 20) as d
 cross join lateral (select
     (array[ 0, 1,-1, 0, 1, 0,-1, 1, 0,-1, 0, 1,-1, 0])[1 + ((d + b.ord    ) % 14)] as m,
     (array[ 1, 0,-1, 1, 0,-1, 0, 0, 1,-1, 1, 0, 0,-1])[1 + ((d + b.ord * 2) % 14)] as e,
     (array[ 0,-1, 1, 0, 1,-1, 0, 1,-1, 0, 1, 0,-1, 1])[1 + ((d + b.ord * 3) % 14)] as p,
     (array[-1, 0, 1, 1, 0, 0,-1, 0, 1,-1, 0, 1, 0,-1])[1 + ((d + b.ord * 5) % 14)] as w
   ) as j
 where extract(dow from current_date - d) not in (0, 6)
   and ((d + b.ord) % 5) <> 0;

-- The API caches the schema it exposes; this migration changes no DDL, so
-- there is nothing for it to miss. Left out on purpose.
