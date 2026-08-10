begin;
select plan(4);

select is((select count(*)::int from identity.orgs where name = 'Northwind'),
          1, 'the Northwind org exists');
select is((select count(*)::int from identity.people
            where org_id = (select id from identity.orgs where name='Northwind')),
          2, 'Northwind has two seeded people');

-- Wilson holds both roles. This is the departure from the prototype:
-- HR staff are employees and have their own wellbeing.
select set_eq(
  $$ select role from identity.person_roles pr
       join identity.people p on p.id = pr.person_id
      where lower(p.email) = 'wilson.dayrit@northwind.example' $$,
  array['employee','hr'],
  'Wilson is both an employee and HR'
);
select set_eq(
  $$ select role from identity.person_roles pr
       join identity.people p on p.id = pr.person_id
      where lower(p.email) = 'celine.nolasco@northwind.example' $$,
  array['employee'],
  'Celine is an employee only'
);

select * from finish();
rollback;
