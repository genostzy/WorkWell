-- PostgREST schema cache can go stale after DDL. The payroll/expenses
-- screens were seeing "Could not find table 'public.salary_requests'"
-- and "Could not find column 'description' of 'expenses'" even though
-- the tables/views exist (0024_hr_features). Force a reload.
-- Also re-create the two views that were most often stale to ensure they
-- are present with correct columns, in case a prior migration was skipped
-- due to duplicate 0024 numbering.

create or replace view public.expenses with (security_invoker = true) as
  select id, person_id, description, amount, category, receipt_url,
         status, decided_by, decided_at, created_at from work.expenses;

create or replace view public.payslips with (security_invoker = true) as
  select id, person_id, period_start, period_end, gross, deductions,
         net, status, created_at from work.payslips;

create or replace view public.salary_requests with (security_invoker = true) as
  select id, person_id, kind, detail, status, decided_by,
         decided_at, created_at from work.salary_requests;

grant select, insert, update, delete on public.expenses, public.salary_requests to authenticated;
grant select on public.payslips to authenticated;

-- Ensure policies exist (re-created from 0033 if needed) — idempotent
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'expenses_select' and tablename = 'expenses') then
    create policy expenses_select on work.expenses for select to authenticated using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
