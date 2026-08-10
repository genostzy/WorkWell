-- Four schemas, one per plane. private and org_agg are created closed:
-- no grants to any API role. Later slices add tables inside an already
-- shut boundary rather than opening one.
create schema if not exists identity;
create schema if not exists private;
create schema if not exists work;
create schema if not exists org_agg;

-- The aggregation job's role. nologin means no password exists, so no
-- client can authenticate as it; slice E's pg_cron job reaches its
-- privileges through a security definer function this role owns.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_aggregator') then
    create role app_aggregator nologin;
  end if;
end $$;

-- identity is readable by signed-in users because authorization joins
-- through it. Row visibility is still decided by RLS in migration 0004.
grant usage on schema identity to authenticated;

-- private, work and org_agg get no grants here. Each later slice grants
-- exactly what its tables need, to exactly the roles that need them.
revoke all on schema private from public, anon, authenticated;
revoke all on schema org_agg from public, anon, authenticated;
revoke all on schema work    from public, anon, authenticated;
