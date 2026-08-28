-- A populated directory.
--
-- The org had one real employee and nine rows called "Test Employee N",
-- all Software Engineers in Engineering with every optional field null.
-- That is enough to prove a query and not enough to see anything: the
-- directory sorts into one block, the department column has one value, and
-- the org screen's cohort suppression (which hides any group under eight
-- people) can never be exercised against a realistic spread.
--
-- Written out rather than generated. A migration that calls random() is a
-- migration that produces a different database every time it runs, which
-- makes "it works on mine" unanswerable — and these are meant to be
-- recognisable people to point at while testing, not noise.
--
-- No auth users: these rows have auth_user_id null, exactly as the seeded
-- test rows already do. They appear in the directory, can be given tasks
-- and hold an employment record; nobody can sign in as them. Creating real
-- accounts is HR's job through invite_person(), not a migration's.

insert into identity.people (id, org_id, email, full_name, status)
values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'mara.villanueva@workwell.com',  'Mara Villanueva', 'active'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'tomas.reyes@workwell.com',      'Tomas Reyes',     'active'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'joy.abellera@workwell.com',     'Joy Abellera',    'active'),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'nico.pangilinan@workwell.com',  'Nico Pangilinan', 'active'),
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'aileen.cortez@workwell.com',    'Aileen Cortez',   'active'),
  ('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'rafael.domingo@workwell.com',   'Rafael Domingo',  'active'),
  ('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'bea.salcedo@workwell.com',      'Bea Salcedo',     'active'),
  ('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'ken.oquendo@workwell.com',      'Ken Oquendo',     'active'),
  ('d0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'lianne.batac@workwell.com',     'Lianne Batac',    'active'),
  ('d0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'oscar.mendoza@workwell.com',    'Oscar Mendoza',   'active'),
  ('d0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000001', 'grace.tumang@workwell.com',     'Grace Tumang',    'active'),
  ('d0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000001', 'paolo.serrano@workwell.com',    'Paolo Serrano',   'active')
on conflict (id) do nothing;

-- Every optional field filled, because the point of these rows is to show
-- the screens with something in them. Managers point at other seeded
-- people, which is what makes the directory's Manager column and the
-- employment editor's dropdown worth looking at.
insert into work.employment
  (person_id, job_title, department, team, manager_id, contract_type, location, started_on, entitlement)
values
  ('d0000000-0000-0000-0000-000000000001', 'Operations Lead',       'Operations',  'Service desk', null,                                   'Full time',    'Manila',    date '2023-02-06', 22),
  ('d0000000-0000-0000-0000-000000000002', 'Facilities Technician', 'Maintenance', 'Grounds',      null,                                   'Full time',    'Manila',    date '2024-07-15', 20),
  ('d0000000-0000-0000-0000-000000000003', 'Payroll Officer',       'Finance',     'Payroll',      null,                                   'Full time',    'Manila',    date '2022-11-02', 24),
  ('d0000000-0000-0000-0000-000000000004', 'Support Specialist',    'Operations',  'Service desk', 'd0000000-0000-0000-0000-000000000001', 'Full time',    'Cebu City', date '2025-01-13', 20),
  ('d0000000-0000-0000-0000-000000000005', 'Accounts Assistant',    'Finance',     'Payroll',      'd0000000-0000-0000-0000-000000000003', 'Part time',    'Manila',    date '2025-03-03', 12),
  ('d0000000-0000-0000-0000-000000000006', 'Security Officer',      'Maintenance', 'Night watch',  'd0000000-0000-0000-0000-000000000002', 'Full time',    'Manila',    date '2021-09-20', 20),
  ('d0000000-0000-0000-0000-000000000007', 'Recruitment Partner',   'People',      'Hiring',       null,                                   'Full time',    'Manila',    date '2023-06-12', 22),
  ('d0000000-0000-0000-0000-000000000008', 'Data Analyst',          'Engineering', 'Insights',     null,                                   'Full time',    'Remote',    date '2024-02-19', 20),
  ('d0000000-0000-0000-0000-000000000009', 'Junior Developer',      'Engineering', 'Insights',     'd0000000-0000-0000-0000-000000000008', 'Probationary', 'Remote',    date '2026-06-01', 15),
  ('d0000000-0000-0000-0000-00000000000a', 'Warehouse Coordinator', 'Logistics',   'Inbound',      null,                                   'Full time',    'Cebu City', date '2022-04-04', 20),
  ('d0000000-0000-0000-0000-00000000000b', 'Customer Care Agent',   'Operations',  'Service desk', 'd0000000-0000-0000-0000-000000000001', 'Contract',     'Cebu City', date '2025-08-11', 10),
  ('d0000000-0000-0000-0000-00000000000c', 'Training Officer',      'People',      'Hiring',       'd0000000-0000-0000-0000-000000000007', 'Full time',    'Manila',    date '2023-10-09', 22)
on conflict (person_id) do nothing;

-- The nine placeholder rows get real details too, rather than staying the
-- block of identical engineers they were. Their names are left alone:
-- renaming a row somebody may already have assigned work to would quietly
-- change who that work appears to belong to.
update work.employment e set
  job_title  = v.job_title,
  department = v.department,
  team       = v.team,
  location   = v.location,
  started_on = v.started_on
from (values
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'Backend Developer',   'Engineering', 'Platform', 'Manila',    date '2021-03-01'),
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'Frontend Developer',  'Engineering', 'Platform', 'Remote',    date '2021-08-16'),
  ('c0000000-0000-0000-0000-000000000003'::uuid, 'QA Engineer',         'Engineering', 'Quality',  'Manila',    date '2022-01-10'),
  ('c0000000-0000-0000-0000-000000000004'::uuid, 'DevOps Engineer',     'Engineering', 'Platform', 'Remote',    date '2022-05-23'),
  ('c0000000-0000-0000-0000-000000000005'::uuid, 'Mobile Developer',    'Engineering', 'Apps',     'Cebu City', date '2023-01-09'),
  ('c0000000-0000-0000-0000-000000000006'::uuid, 'Solutions Architect', 'Engineering', 'Platform', 'Manila',    date '2020-07-06'),
  ('c0000000-0000-0000-0000-000000000007'::uuid, 'Product Designer',    'Design',      'Product',  'Manila',    date '2023-09-18'),
  ('c0000000-0000-0000-0000-000000000008'::uuid, 'UX Researcher',       'Design',      'Product',  'Remote',    date '2024-04-08'),
  ('c0000000-0000-0000-0000-000000000009'::uuid, 'Technical Writer',    'Design',      'Content',  'Cebu City', date '2024-10-21')
) as v(person_id, job_title, department, team, location, started_on)
where e.person_id = v.person_id;
