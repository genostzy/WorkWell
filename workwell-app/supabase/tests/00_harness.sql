begin;
select plan(1);
select has_schema('identity', 'the identity schema exists');
select * from finish();
rollback;
