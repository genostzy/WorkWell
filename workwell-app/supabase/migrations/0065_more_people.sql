-- Every department but Engineering was hidden on the organisation screen
-- -- org_agg.refresh() (0034) suppresses any department with fewer than 8
-- distinct people checked in over the last 30 days, and Operations (4),
-- Finance (3), Maintenance (3), People (3) and Logistics (1) all sat well
-- under that. Twenty-nine more people, spread so every department clears
-- eight -- not evenly, because a real org's departments never are.
--
-- Same rules as 0059 and 0060: written out rather than generated (no
-- random(), so this produces the same database on every run), no auth
-- users (auth_user_id stays null -- they hold a directory entry and an
-- employment record, nobody can sign in as them), and check-ins derived
-- arithmetically from a fixed per-person baseline rather than random so
-- the numbers are reproducible too.
--
-- Manager chains mostly point at the department lead 0060 already
-- established (Marlon, Lincoln, Patricia, Carding, Viy). Logistics had no
-- lead at all -- Kuya Inday runs the pantry solo by design, not as
-- anyone's manager -- so this gives the department an actual coordinator
-- (Bimbo Escario) for the rest of it to report to, and leaves her exactly
-- as she was.

insert into identity.people (id, org_id, email, full_name, status) values
  -- Engineering
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ronnel.baltazar@workwell.com',   'Ronnel Baltazar',    'active'),
  ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'cristy.manalastas@workwell.com', 'Cristy Manalastas',  'active'),
  ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'jhun.rivera@workwell.com',       'Jhun Rivera',        'active'),
  -- Operations
  ('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'deniel.ocampo@workwell.com',     'Deniel Ocampo',      'active'),
  ('f0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'marites.ubaldo@workwell.com',    'Marites Ubaldo',     'active'),
  ('f0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'boyet.fajardo@workwell.com',     'Boyet Fajardo',      'active'),
  ('f0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'shiela.panganiban@workwell.com', 'Shiela Panganiban',  'active'),
  -- Finance
  ('f0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'wendell.cabrera@workwell.com',   'Wendell Cabrera',    'active'),
  ('f0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'loraine.sumalinog@workwell.com', 'Loraine Sumalinog',  'active'),
  ('f0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'ariel.mangubat@workwell.com',    'Ariel Mangubat',     'active'),
  ('f0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000001', 'ditas.formoso@workwell.com',     'Ditas Formoso',      'active'),
  ('f0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000001', 'nestor.villaraza@workwell.com',  'Nestor Villaraza',   'active'),
  -- Maintenance
  ('f0000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-000000000001', 'rodel.espino@workwell.com',      'Rodel Espino',       'active'),
  ('f0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-000000000001', 'baby.custodio@workwell.com',     'Aling Baby Custodio','active'),
  ('f0000000-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001', 'efren.tolentino@workwell.com',   'Efren Tolentino',    'active'),
  ('f0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'randy.buenaflor@workwell.com',   'Randy Buenaflor',    'active'),
  ('f0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'zaldy.marquez@workwell.com',     'Zaldy Marquez',      'active'),
  -- People
  ('f0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'cherryanne.robledo@workwell.com','Cherry Anne Robledo','active'),
  ('f0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'ferdie.locsin@workwell.com',     'Ferdie Locsin',      'active'),
  ('f0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'gina.bautista@workwell.com',     'Gina Bautista',      'active'),
  ('f0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'nonoy.sarmiento@workwell.com',   'Nonoy Sarmiento',    'active'),
  ('f0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001', 'precy.datu@workwell.com',        'Precy Datu',         'active'),
  -- Logistics
  ('f0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000001', 'bimbo.escario@workwell.com',     'Bimbo Escario',      'active'),
  ('f0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000001', 'yolly.manansala@workwell.com',   'Yolly Manansala',    'active'),
  ('f0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000001', 'dodong.pineda@workwell.com',     'Dodong Pineda',      'active'),
  ('f0000000-0000-0000-0000-00000000001a', 'a0000000-0000-0000-0000-000000000001', 'malou.ferrer@workwell.com',      'Malou Ferrer',       'active'),
  ('f0000000-0000-0000-0000-00000000001b', 'a0000000-0000-0000-0000-000000000001', 'jayson.balagtas@workwell.com',   'Jayson Balagtas',    'active'),
  ('f0000000-0000-0000-0000-00000000001c', 'a0000000-0000-0000-0000-000000000001', 'cristeta.amoroso@workwell.com',  'Cristeta Amoroso',   'active'),
  ('f0000000-0000-0000-0000-00000000001d', 'a0000000-0000-0000-0000-000000000001', 'tining.villamor@workwell.com',   'Tining Villamor',    'active')
on conflict (id) do nothing;

insert into identity.person_roles (person_id, role)
select id, 'employee' from identity.people where id::text like 'f0000000-%';

insert into work.employment
  (person_id, job_title, department, team, manager_id, contract_type, location, started_on, entitlement)
values
  -- Engineering, under Marlon (Systems Administrator, existing lead)
  ('f0000000-0000-0000-0000-000000000001', 'DevOps Engineer',      'Engineering', 'Platform', 'e0000000-0000-0000-0000-000000000003', 'Full time',    'Remote',    date '2023-04-11', 20),
  ('f0000000-0000-0000-0000-000000000002', 'Mobile Developer',     'Engineering', 'Platform', 'e0000000-0000-0000-0000-000000000003', 'Full time',    'Cebu City', date '2024-09-02', 20),
  ('f0000000-0000-0000-0000-000000000003', 'Backend Developer',    'Engineering', 'Platform', 'e0000000-0000-0000-0000-000000000003', 'Contract',     'Remote',    date '2026-02-16', 12),

  -- Operations, under Lincoln (Operations Manager, existing lead)
  ('f0000000-0000-0000-0000-000000000004', 'Fleet Coordinator',       'Operations', 'Dispatch',      'e0000000-0000-0000-0000-000000000001', 'Full time',    'Cebu City', date '2022-08-22', 20),
  ('f0000000-0000-0000-0000-000000000005', 'Customer Care Agent',     'Operations', 'Service desk',  'e0000000-0000-0000-0000-000000000001', 'Full time',    'Manila',    date '2023-05-30', 20),
  ('f0000000-0000-0000-0000-000000000006', 'Customer Care Agent',     'Operations', 'Service desk',  'e0000000-0000-0000-0000-000000000001', 'Part time',    'Manila',    date '2025-11-10', 10),
  ('f0000000-0000-0000-0000-000000000007', 'Scheduling Coordinator',  'Operations', 'Dispatch',      'e0000000-0000-0000-0000-000000000001', 'Full time',    'Manila',    date '2024-01-15', 20),

  -- Finance, under Patricia (Finance Lead, existing lead)
  ('f0000000-0000-0000-0000-000000000008', 'Budget Analyst',         'Finance', 'Payroll', 'e0000000-0000-0000-0000-000000000006', 'Full time', 'Manila',    date '2021-11-08', 22),
  ('f0000000-0000-0000-0000-000000000009', 'Accounts Payable Clerk', 'Finance', 'Payroll', 'e0000000-0000-0000-0000-000000000006', 'Full time', 'Manila',    date '2023-07-19', 20),
  ('f0000000-0000-0000-0000-00000000000a', 'Bookkeeper',             'Finance', 'Payroll', 'e0000000-0000-0000-0000-000000000006', 'Part time', 'Remote',    date '2024-10-01', 12),
  ('f0000000-0000-0000-0000-00000000000b', 'Collections Officer',    'Finance', 'Payroll', 'e0000000-0000-0000-0000-000000000006', 'Full time', 'Cebu City', date '2022-03-14', 20),
  ('f0000000-0000-0000-0000-00000000000c', 'Treasury Assistant',     'Finance', 'Payroll', 'e0000000-0000-0000-0000-000000000006', 'Probationary', 'Manila', date '2026-07-20', 10),

  -- Maintenance, under Carding (Facilities Technician, existing lead)
  ('f0000000-0000-0000-0000-00000000000d', 'Groundskeeper',           'Maintenance', 'Grounds',     'e0000000-0000-0000-0000-000000000010', 'Full time', 'Manila', date '2018-06-04', 22),
  ('f0000000-0000-0000-0000-00000000000e', 'Janitorial Supervisor',   'Maintenance', 'Grounds',     'e0000000-0000-0000-0000-000000000010', 'Full time', 'Manila', date '2014-02-17', 26),
  ('f0000000-0000-0000-0000-00000000000f', 'HVAC Technician',         'Maintenance', 'Grounds',     'e0000000-0000-0000-0000-000000000010', 'Contract',  'Manila', date '2025-05-05', 12),
  ('f0000000-0000-0000-0000-000000000010', 'Security Officer',        'Maintenance', 'Night watch', 'e0000000-0000-0000-0000-000000000010', 'Full time', 'Manila', date '2020-09-28', 20),
  ('f0000000-0000-0000-0000-000000000011', 'Electrician',             'Maintenance', 'Grounds',     'e0000000-0000-0000-0000-000000000010', 'Full time', 'Manila', date '2019-12-03', 20),

  -- People, under Viy (People Partner, existing lead)
  ('f0000000-0000-0000-0000-000000000012', 'HR Generalist',                     'People', 'Hiring', 'e0000000-0000-0000-0000-000000000002', 'Full time', 'Manila', date '2022-06-27', 20),
  ('f0000000-0000-0000-0000-000000000013', 'Talent Acquisition Specialist',     'People', 'Hiring', 'e0000000-0000-0000-0000-000000000002', 'Full time', 'Remote', date '2023-09-11', 20),
  ('f0000000-0000-0000-0000-000000000014', 'Compensation & Benefits Analyst',   'People', 'Hiring', 'e0000000-0000-0000-0000-000000000002', 'Full time', 'Manila', date '2021-04-19', 22),
  ('f0000000-0000-0000-0000-000000000015', 'Employee Relations Officer',        'People', 'Hiring', 'e0000000-0000-0000-0000-000000000002', 'Full time', 'Manila', date '2024-03-08', 20),
  ('f0000000-0000-0000-0000-000000000016', 'Learning & Development Coordinator','People', 'Hiring', 'e0000000-0000-0000-0000-000000000002', 'Part time', 'Remote', date '2025-08-04', 10),

  -- Logistics. Kuya Inday keeps running the pantry solo, as before -- Bimbo
  -- becomes the department's first actual coordinator, and the rest of the
  -- new logistics hires report to him rather than to her.
  ('f0000000-0000-0000-0000-000000000017', 'Warehouse Coordinator',   'Logistics', 'Stores', null,                                   'Full time', 'Cebu City', date '2020-01-20', 22),
  ('f0000000-0000-0000-0000-000000000018', 'Inventory Clerk',         'Logistics', 'Stores', 'f0000000-0000-0000-0000-000000000017', 'Full time', 'Cebu City', date '2023-02-13', 20),
  ('f0000000-0000-0000-0000-000000000019', 'Delivery Coordinator',    'Logistics', 'Stores', 'f0000000-0000-0000-0000-000000000017', 'Full time', 'Manila',    date '2022-10-24', 20),
  ('f0000000-0000-0000-0000-00000000001a', 'Procurement Officer',     'Logistics', 'Stores', 'f0000000-0000-0000-0000-000000000017', 'Full time', 'Manila',    date '2021-07-01', 22),
  ('f0000000-0000-0000-0000-00000000001b', 'Fleet Dispatcher',        'Logistics', 'Stores', 'f0000000-0000-0000-0000-000000000017', 'Full time', 'Cebu City', date '2024-05-27', 20),
  ('f0000000-0000-0000-0000-00000000001c', 'Supply Chain Analyst',    'Logistics', 'Stores', 'f0000000-0000-0000-0000-000000000017', 'Contract',  'Remote',    date '2025-09-15', 12),
  ('f0000000-0000-0000-0000-00000000001d', 'Loading Bay Supervisor',  'Logistics', 'Stores', 'f0000000-0000-0000-0000-000000000017', 'Full time', 'Manila',    date '2017-11-09', 24)
on conflict (person_id) do nothing;

-- ------------------------------------------------------------- Check-ins
--
-- org_agg.refresh() counts distinct people checked in over the trailing
-- 30 days -- headcount, not payroll -- so this is the part that actually
-- clears the suppression, not the employment rows above. Same derivation
-- as 0060: a fixed baseline per person plus fixed jitter arrays keyed off
-- an ordinal, so the numbers are identical on every run of this file.
-- Ordinals continue from 0060's (1-18) at 19, so the two seedings jitter
-- independently rather than repeating each other's pattern.

insert into private.check_ins (person_id, day, mood, energy, pressure, workload, created_at)
select b.person_id,
       current_date - d,
       greatest(1, least(5, b.mood     + j.m)),
       greatest(1, least(5, b.energy   + j.e)),
       greatest(1, least(5, b.pressure + j.p)),
       greatest(1, least(5, b.workload + j.w)),
       (current_date - d) + time '09:05' + (b.ord * interval '7 minutes')
  from (values
    -- person                                        ord  mood energy pressure workload
    ('f0000000-0000-0000-0000-000000000001'::uuid, 19, 4,3,3,4),  -- Ronnel
    ('f0000000-0000-0000-0000-000000000002'::uuid, 20, 4,4,3,3),  -- Cristy
    ('f0000000-0000-0000-0000-000000000003'::uuid, 21, 3,3,4,4),  -- Jhun, contract
    ('f0000000-0000-0000-0000-000000000004'::uuid, 22, 4,4,3,4),  -- Deniel
    ('f0000000-0000-0000-0000-000000000005'::uuid, 23, 3,3,4,3),  -- Marites
    ('f0000000-0000-0000-0000-000000000006'::uuid, 24, 4,4,2,2),  -- Boyet, part time
    ('f0000000-0000-0000-0000-000000000007'::uuid, 25, 4,4,3,4),  -- Shiela
    ('f0000000-0000-0000-0000-000000000008'::uuid, 26, 3,3,4,4),  -- Wendell
    ('f0000000-0000-0000-0000-000000000009'::uuid, 27, 4,4,3,3),  -- Loraine
    ('f0000000-0000-0000-0000-00000000000a'::uuid, 28, 4,4,2,2),  -- Ariel, part time
    ('f0000000-0000-0000-0000-00000000000b'::uuid, 29, 3,3,4,4),  -- Ditas
    ('f0000000-0000-0000-0000-00000000000c'::uuid, 30, 3,4,4,3),  -- Nestor, probation
    ('f0000000-0000-0000-0000-00000000000d'::uuid, 31, 4,4,2,3),  -- Rodel
    ('f0000000-0000-0000-0000-00000000000e'::uuid, 32, 5,4,2,3),  -- Aling Baby, 11 years
    ('f0000000-0000-0000-0000-00000000000f'::uuid, 33, 4,3,3,3),  -- Efren, contract
    ('f0000000-0000-0000-0000-000000000010'::uuid, 34, 3,2,3,3),  -- Randy, nights
    ('f0000000-0000-0000-0000-000000000011'::uuid, 35, 4,4,2,3),  -- Zaldy
    ('f0000000-0000-0000-0000-000000000012'::uuid, 36, 4,4,3,3),  -- Cherry Anne
    ('f0000000-0000-0000-0000-000000000013'::uuid, 37, 4,4,3,4),  -- Ferdie
    ('f0000000-0000-0000-0000-000000000014'::uuid, 38, 4,3,3,3),  -- Gina
    ('f0000000-0000-0000-0000-000000000015'::uuid, 39, 3,3,4,4),  -- Nonoy
    ('f0000000-0000-0000-0000-000000000016'::uuid, 40, 4,4,2,2),  -- Precy, part time
    ('f0000000-0000-0000-0000-000000000017'::uuid, 41, 4,4,3,4),  -- Bimbo, new coordinator
    ('f0000000-0000-0000-0000-000000000018'::uuid, 42, 3,3,4,4),  -- Yolly
    ('f0000000-0000-0000-0000-000000000019'::uuid, 43, 4,4,3,4),  -- Dodong
    ('f0000000-0000-0000-0000-00000000001a'::uuid, 44, 4,4,3,3),  -- Malou
    ('f0000000-0000-0000-0000-00000000001b'::uuid, 45, 3,3,4,4),  -- Jayson
    ('f0000000-0000-0000-0000-00000000001c'::uuid, 46, 4,4,3,3),  -- Cristeta, contract
    ('f0000000-0000-0000-0000-00000000001d'::uuid, 47, 5,4,2,3)   -- Tining, 9 years
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

-- The aggregate a viewer actually sees is a snapshot (org_agg.cohorts /
-- org_agg.cohort_metrics), rebuilt nightly by a cron job (0018) rather
-- than computed live. Nobody would see the effect of the two inserts
-- above until 02:15 without this.
select org_agg.refresh(30);
