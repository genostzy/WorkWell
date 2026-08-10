begin;
select plan(5);

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

-- The same address invited by two orgs is a legal shape, because email is
-- unique per org rather than globally. Linking both rows would violate the
-- unique constraint on auth_user_id and abort the auth.users insert that
-- fired the trigger, leaving that person unable to sign in at all.
insert into identity.orgs (id, name) values
  ('77777777-7777-7777-7777-777777777777', 'Org One'),
  ('88888888-8888-8888-8888-888888888888', 'Org Two');
insert into identity.people (org_id, email, full_name, status) values
  ('77777777-7777-7777-7777-777777777777', 'both@two.example', 'Both One', 'invited'),
  ('88888888-8888-8888-8888-888888888888', 'BOTH@two.example', 'Both Two', 'invited');

select lives_ok(
  $$ insert into auth.users (id, email)
       values ('99999999-9999-9999-9999-999999999999', 'both@two.example') $$,
  'an ambiguous invitation still allows the account to be created'
);
select is(
  (select count(*)::int from identity.people
    where auth_user_id = '99999999-9999-9999-9999-999999999999'),
  0,
  'an ambiguous invitation links to no person'
);

select * from finish();
rollback;
