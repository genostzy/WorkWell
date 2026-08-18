-- "Something's off with my team" — a quiet, no-target signal.
--
-- This is deliberately NOT the anonymous-flag-a-colleague feature: it names
-- no one, targets no one, and carries no free text. A person can only ever
-- raise it about their own team as a whole, and it only ever reaches HR as
-- a share of an already-anonymous, already-8-or-more cohort — the exact
-- protection org_agg's mood/energy/pressure figures already carry on
-- Structural load. Naming a specific colleague, even anonymously, is a
-- harassment vector with no way to contest a false flag; this avoids that
-- shape of feature entirely rather than building it carefully.

create table private.team_signals (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references identity.people(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index team_signals_person_idx
  on private.team_signals (person_id, created_at desc);

alter table private.team_signals enable row level security;

-- Select-own only, so a person can see (and via the RPC below, withdraw)
-- what they raised — the same revocability principle "Ask for support"
-- already carries. No insert/update/delete policy: writes go through
-- raise_team_signal/withdraw_team_signal only, mirroring attendance.
create policy team_signals_select on private.team_signals
  for select to authenticated
  using (person_id = identity.current_person_id());

grant select on private.team_signals to authenticated;

create view public.team_signals
  with (security_invoker = true)
  as select id, person_id, created_at from private.team_signals;

grant select on public.team_signals to authenticated;

-- Supabase's default privileges grant authenticated more than this
-- explicit select regardless (see 0028) — close it the same way, rather
-- than relying on RLS alone to be the only thing standing in the way.
revoke insert, update, delete, truncate, references, trigger
  on public.team_signals from authenticated, anon;
revoke insert, update, delete, truncate, references, trigger
  on private.team_signals from authenticated, anon;

create function public.raise_team_signal() returns void
language plpgsql
security definer
set search_path to ''
as $$
declare me uuid := identity.current_person_id();
begin
  if me is null then
    raise exception 'this account is not linked to a person' using errcode = '42501';
  end if;
  insert into private.team_signals (person_id) values (me);
end;
$$;

revoke all on function public.raise_team_signal() from public;
grant execute on function public.raise_team_signal() to authenticated;

create function public.withdraw_team_signal(p_id uuid) returns void
language plpgsql
security definer
set search_path to ''
as $$
declare me uuid := identity.current_person_id();
begin
  if me is null then
    raise exception 'this account is not linked to a person' using errcode = '42501';
  end if;
  delete from private.team_signals where id = p_id and person_id = me;
end;
$$;

revoke all on function public.withdraw_team_signal(uuid) from public;
grant execute on function public.withdraw_team_signal(uuid) to authenticated;

-- ---------------------------------------------------- org_agg extension

alter table org_agg.cohort_metrics drop constraint cohort_metrics_metric_check;
alter table org_agg.cohort_metrics
  add constraint cohort_metrics_metric_check
  check (metric in ('mood', 'energy', 'pressure', 'concern'));

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
          ('mood', c.mood), ('energy', c.energy), ('pressure', c.pressure)
        ) as m(metric, v)
       where c.day >= current_date - p_days
         and m.v is not null
    ) s
   group by org_id, cohort, metric
  -- The rule. Applied before the row exists, so there is nothing to leak.
  having count(distinct person_id) >= 8;

  -- Always one row per already-qualifying cohort, even at 0.00 — never
  -- omitted when nobody raised anything. If the row only existed when the
  -- count was nonzero, the row's mere presence would itself leak that
  -- someone raised something, before HR ever reads the value. Same reason
  -- suppressed cohorts stay named on Structural load instead of vanishing.
  insert into org_agg.cohort_metrics (org_id, cohort, metric, value, n)
  select coh.org_id, coh.cohort, 'concern',
         round(count(distinct ts.person_id)::numeric / coh.headcount, 2),
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
