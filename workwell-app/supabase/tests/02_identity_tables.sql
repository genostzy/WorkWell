begin;
select plan(9);

select has_table('identity', 'orgs',         'orgs table exists');
select has_table('identity', 'people',       'people table exists');
select has_table('identity', 'person_roles', 'person_roles table exists');

select col_is_pk('identity', 'people', 'id', 'people.id is the primary key');
select col_is_fk('identity', 'people', 'org_id', 'people.org_id is a foreign key');

-- Both indexes are load-bearing, not housekeeping: current_person_id()
-- runs on essentially every query and joins through both.
select has_index('identity', 'people', 'people_auth_user_id_idx',
                 'auth_user_id is indexed');
select has_index('identity', 'people', 'people_org_email_key',
                 'email is unique per org, case-insensitively');
select has_index('identity', 'person_roles', 'person_roles_person_id_idx',
                 'person_roles.person_id is indexed');

select col_has_check('identity', 'people', 'status',
                     'status is constrained to known values');

select * from finish();
rollback;
