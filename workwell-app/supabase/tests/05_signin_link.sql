begin;
select plan(3);

insert into identity.orgs (id, name)
  values ('44444444-4444-4444-4444-444444444444', 'Link Test');
insert into identity.people (org_id, email, full_name, status)
  values ('44444444-4444-4444-4444-444444444444',
          'Invited.Person@Link.example', 'Invited Person', 'invited');

-- Case differs from the stored address on purpose: people type their
-- email however they like.
insert into auth.users (id, email)
  values ('55555555-5555-5555-5555-555555555555', 'invited.person@link.example');

select is(
  (select auth_user_id from identity.people
    where lower(email) = 'invited.person@link.example'),
  '55555555-5555-5555-5555-555555555555'::uuid,
  'the invited person is linked to the new auth user'
);
select is(
  (select status from identity.people
    where lower(email) = 'invited.person@link.example'),
  'active',
  'status flips from invited to active'
);

-- Someone with no invitation gets an account that resolves to nobody.
insert into auth.users (id, email)
  values ('66666666-6666-6666-6666-666666666666', 'stranger@nowhere.example');
select is(
  (select count(*)::int from identity.people
    where auth_user_id = '66666666-6666-6666-6666-666666666666'),
  0,
  'an uninvited sign-in links to no person'
);

select * from finish();
rollback;
