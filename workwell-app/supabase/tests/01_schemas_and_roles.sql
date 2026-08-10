begin;
select plan(8);

select has_schema('identity',  'identity schema exists');
select has_schema('private',   'private schema exists');
select has_schema('work',      'work schema exists');
select has_schema('org_agg',   'org_agg schema exists');

-- The boundary: the public API roles cannot even enter the private schema.
select ok(
  not has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated has no usage on private'
);
select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anon has no usage on private'
);

select has_role('app_aggregator', 'app_aggregator role exists');

-- nologin is what makes it unreachable: there is no password to present.
select is(
  (select rolcanlogin from pg_roles where rolname = 'app_aggregator'),
  false,
  'app_aggregator cannot log in'
);

select * from finish();
rollback;
