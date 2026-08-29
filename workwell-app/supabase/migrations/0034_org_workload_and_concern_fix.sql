-- 0034: F7 — include workload + harden org_agg refresh.

-- Metric check previously allowed mood/energy/pressure/concern; add workload and
-- the five PRD passive-signal stubs as suppressed-state precursors (workload is
-- real data today; others are structural placeholders until passive signals ship).
alter table org_agg.cohort_metrics drop constraint if exists cohort_metrics_metric_check;
alter table org_agg.cohort_metrics
  add constraint cohort_metrics_metric_check
  check (metric in ('mood','energy','pressure','workload','concern',
                   'working_hours','meeting_load','after_hours','time_off','workload_pattern'));

create or replace function org_agg.refresh(p_days int default 30)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
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
          ('mood', c.mood), ('energy', c.energy), ('pressure', c.pressure), ('workload', c.workload)
        ) as m(metric, v)
       where c.day >= current_date - p_days
         and m.v is not null
    ) s
   group by org_id, cohort, metric
  having count(distinct person_id) >= 8;

  -- Concern share (0.00 even when none raised — presence must not leak).
  insert into org_agg.cohort_metrics (org_id, cohort, metric, value, n)
  select coh.org_id, coh.cohort, 'concern',
         round(count(distinct ts.person_id)::numeric / nullif(coh.headcount,0), 2),
         coh.headcount
    from org_agg.cohorts coh
    join identity.people p on p.org_id = coh.org_id
    join work.employment e on e.person_id = p.id and e.department = coh.cohort
    left join private.team_signals ts
      on ts.person_id = p.id
     and ts.created_at >= (current_date - p_days)::timestamptz
   where coh.suppressed = false
   group by coh.org_id, coh.cohort, coh.headcount;
end;
$$;

revoke all on function org_agg.refresh(int) from public;
