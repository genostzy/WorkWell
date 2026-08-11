-- The organisation plane: anonymous cohort aggregates.
--
-- PRD §6 requires the 8-person rule be enforced server-side, before data
-- leaves the aggregation layer — never in the browser. So it is enforced
-- here, at write time: a metric row for a group under 8 is never created,
-- which means no query, no bug, and no curious HR user can surface one.
--
-- PRD §8 also requires suppressed groups be NAMED rather than silently
-- dropped, because a gap that appears and disappears is itself a signal.
-- Hence two tables: the roster of cohorts with headcounts, and the metrics
-- that only exist for cohorts large enough to publish.

create table org_agg.cohorts (
  org_id      uuid not null references identity.orgs(id) on delete cascade,
  cohort      text not null,
  headcount   int  not null,
  suppressed  boolean not null,
  computed_at timestamptz not null default now(),
  primary key (org_id, cohort)
);

create table org_agg.cohort_metrics (
  org_id      uuid not null references identity.orgs(id) on delete cascade,
  cohort      text not null,
  metric      text not null check (metric in ('mood','energy','pressure')),
  value       numeric(3,2) not null,
  n           int not null check (n >= 8),   -- the rule, as a constraint
  computed_at timestamptz not null default now(),
  primary key (org_id, cohort, metric)
);

alter table org_agg.cohorts        enable row level security;
alter table org_agg.cohort_metrics enable row level security;

-- HR of that org, and nobody else. An employee has no business here, and
-- neither does HR at another company.
create policy cohorts_read on org_agg.cohorts
  for select to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id());

create policy cohort_metrics_read on org_agg.cohort_metrics
  for select to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id());

grant usage on schema org_agg to authenticated;
grant select on org_agg.cohorts, org_agg.cohort_metrics to authenticated;

create view public.org_cohorts
  with (security_invoker = true)
  as select org_id, cohort, headcount, suppressed, computed_at
       from org_agg.cohorts;

create view public.org_metrics
  with (security_invoker = true)
  as select org_id, cohort, metric, value, n, computed_at
       from org_agg.cohort_metrics;

grant select on public.org_cohorts, public.org_metrics to authenticated;

-- The aggregation itself.
--
-- This is the one routine in the system that reads private.check_ins in
-- bulk. It is deliberately NOT granted to `authenticated`: no HTTP request
-- can invoke it. It runs from the database side only — a scheduled job in
-- production — and it emits nothing but aggregates of eight or more.
create or replace function org_agg.refresh(p_days int default 30)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- Replace wholesale inside one transaction. PRD §8: a job that fails
  -- halfway must leave nothing, because a partial result can break the
  -- 8-person rule invisibly.
  delete from org_agg.cohort_metrics;
  delete from org_agg.cohorts;

  insert into org_agg.cohorts (org_id, cohort, headcount, suppressed)
  select p.org_id,
         e.department,
         count(distinct c.person_id),
         count(distinct c.person_id) < 8
    from private.check_ins c
    join identity.people p on p.id = c.person_id
    join work.employment e on e.person_id = c.person_id
   where c.day >= current_date - p_days
   group by p.org_id, e.department;

  insert into org_agg.cohort_metrics (org_id, cohort, metric, value, n)
  select org_id, cohort, metric, round(avg(v)::numeric, 2), count(distinct person_id)
    from (
      select p.org_id, e.department as cohort, m.metric, m.v, c.person_id
        from private.check_ins c
        join identity.people p on p.id = c.person_id
        join work.employment e on e.person_id = c.person_id
        cross join lateral (values
          ('mood', c.mood), ('energy', c.energy), ('pressure', c.pressure)
        ) as m(metric, v)
       where c.day >= current_date - p_days
         and m.v is not null
    ) s
   group by org_id, cohort, metric
  -- The rule. Applied before the row exists, so there is nothing to leak.
  having count(distinct person_id) >= 8;
end;
$$;

revoke all on function org_agg.refresh(int) from public;
