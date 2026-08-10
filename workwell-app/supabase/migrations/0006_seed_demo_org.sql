insert into identity.orgs (id, name)
values ('a0000000-0000-0000-0000-000000000001', 'Northwind')
on conflict (id) do nothing;

insert into identity.people (id, org_id, email, full_name, status)
values
  ('b0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'celine.nolasco@northwind.example', 'Celine Nolasco', 'invited'),
  ('b0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'wilson.dayrit@northwind.example', 'Wilson Dayrit', 'invited')
on conflict (id) do nothing;

insert into identity.person_roles (person_id, role)
values
  ('b0000000-0000-0000-0000-000000000001', 'employee'),
  ('b0000000-0000-0000-0000-000000000002', 'employee'),
  ('b0000000-0000-0000-0000-000000000002', 'hr')
on conflict do nothing;
