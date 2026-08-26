-- Two gaps found auditing Decisions and Recognition against what HR can
-- actually see and do.

-- ------------------------------------------------------- decision_history
-- 0037 gave work.complaints and work.resignations real decided_by/decided_at
-- columns and working decide flows (decide-complaint.tsx, decide-
-- resignation.tsx both set them, both notify the person). Nobody updated
-- this view to match, so "Decision history" — which bills itself as "all
-- decisions made across the product" — silently drops two of the six
-- domains that actually have one.
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
    from private.attendance_reset_requests where decided_at is not null
  union all
  select 'complaint', id, person_id, status, decided_by, decided_at, created_at
    from work.complaints where decided_at is not null
  union all
  select 'resignation', id, person_id, status, decided_by, decided_at, created_at
    from work.resignations where decided_at is not null;

grant select on public.decision_history to authenticated;

-- ------------------------------------------------------- support_requests
-- "Ask for support" (Recognition) already lets HR read a request the moment
-- it's routed to them (support_requests_read, 0017) — the whole point of
-- the feature is that this is the one deliberate channel to HR. But nothing
-- ever let HR act on one: no update policy existed for them at all, and no
-- page anywhere queried the table outside the employee's own client. A
-- request routed to HR had a reader with no way to acknowledge it and no
-- shelf to sit on.
--
-- HR may only ever move a request from open to closed — never reopen one,
-- never touch a withdrawn one, never see or touch anything routed to the
-- EAP. No notification back to the employee: this feature's whole design is
-- minimal footprint (no tally, no read receipt promised anywhere in its own
-- copy), so closing stays as quiet as everything else here.
create policy support_requests_hr_close on private.support_requests
  for update to authenticated
  using (
    route = 'hr' and status = 'open'
    and identity.is_hr() and identity.same_org(person_id)
  )
  with check (
    status = 'closed'
    and identity.is_hr() and identity.same_org(person_id)
  );
