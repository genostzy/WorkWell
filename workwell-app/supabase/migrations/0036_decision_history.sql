-- The decision-history view main's 0026_decision_history.sql shipped, but
-- rewritten against this branch's actual schema. The original unioned in
-- work.expenses (main's shape: description/lowercase status), work.
-- salary_requests, work.complaints and work.resignations -- none of which
-- exist here (this branch never applied 0024_hr_features.sql: unwired to
-- any client, and incompatible with the work.expenses already live).
--
-- The one client of this view, src/app/(app)/hr/decisions/page.tsx, does
-- `select *` and is already generic over the row shape, so nothing there
-- needed to change -- only which domains are unioned in.
--
-- security_invoker means each underlying table's own RLS still applies
-- per row for whoever queries this: an employee sees only their own
-- decided items, HR sees their org's. The view itself grants nothing
-- beyond what those policies already allow.
create or replace view public.decision_history with (security_invoker = true) as
  select 'leave' as domain, id, person_id, status, decided_by, decided_at, created_at
    from work.leave_requests where decided_at is not null
  union all
  select 'expense', id, person_id, status, decided_by, decided_at, created_at
    from work.expenses where decided_at is not null
  union all
  select 'payroll_request', id, person_id, status, decided_by, decided_at, created_at
    from work.payroll_requests where decided_at is not null
  union all
  select 'attendance_reset', id, person_id, status, decided_by, decided_at, created_at
    from private.attendance_reset_requests where decided_at is not null;

grant select on public.decision_history to authenticated;
