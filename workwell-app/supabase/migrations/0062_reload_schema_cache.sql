-- PostgREST schema cache can go stale after DDL. The payroll/expenses
-- screens were seeing "Could not find table 'public.salary_requests'"
-- and "Could not find column 'description' of 'expenses'" even though
-- the tables/views exist. The true tables after 0033/0034 are:
--   work.expenses (spent_on, note) and work.payroll_requests (not salary_requests)
-- Force a reload and re-create views with correct columns.

-- Expenses: 0033_expenses + 0053_expense_receipts shape
create or replace view public.expenses with (security_invoker = true) as
  select id, person_id, category, amount, spent_on, note, status,
         decided_by, decided_at, created_at, receipt_path
    from work.expenses;

-- Payslips: 0034_payroll shape (period_month, not period_start)
create or replace view public.payslips with (security_invoker = true) as
  select id, person_id, period_month, gross, net, status, created_at
    from work.payslips;

-- Payroll requests: 0034_payroll shape (payroll_requests, not salary_requests)
create or replace view public.payroll_requests with (security_invoker = true) as
  select id, person_id, kind, note, status, decided_by, decided_at, created_at
    from work.payroll_requests;

-- Keep legacy salary_requests view as alias for older clients (now points at payroll_requests)
create or replace view public.salary_requests with (security_invoker = true) as
  select id, person_id, kind, note as detail, status, decided_by, decided_at, created_at
    from work.payroll_requests;

grant select, insert, update on public.expenses to authenticated;
grant select, insert, update on public.payroll_requests to authenticated;
grant select, insert, update on public.salary_requests to authenticated;
grant select on public.payslips to authenticated;

select pg_notify('pgrst', 'reload schema');
