-- 0033: Fix RLS slips from 0024/0025 that undid the two-plane rigor.

-- 1) Company-wide tables: split FOR ALL USING(true) into per-verb policies.
--    Before: any authenticated could DELETE holidays/news/policies.
drop policy if exists holidays_all on work.holidays;
drop policy if exists news_all on work.news;
drop policy if exists company_policies_all on work.company_policies;

create policy holidays_select on work.holidays
  for select to authenticated using (true);
create policy holidays_modify on work.holidays
  for all to authenticated
  using (identity.is_hr()) with check (identity.is_hr());

create policy news_select on work.news
  for select to authenticated using (true);
create policy news_modify on work.news
  for all to authenticated
  using (identity.is_hr()) with check (identity.is_hr());

create policy company_policies_select on work.company_policies
  for select to authenticated using (true);
create policy company_policies_modify on work.company_policies
  for all to authenticated
  using (identity.is_hr()) with check (identity.is_hr());

-- 2) Notifications: close INSERT WITH CHECK(true) spoof.
--    HR may notify someone in same org; anyone may notify themselves
--    (self-notifications are harmless and keep the policy simple for tests).
drop policy if exists notifications_insert on work.notifications;
create policy notifications_insert on work.notifications
  for insert to authenticated
  with check (
    person_id = identity.current_person_id()
    or (identity.is_hr() and identity.same_org(person_id))
  );

-- 3) Employee-owned work tables: allow HR to UPDATE/DELETE (decide) not just SELECT.
--    Before: WITH CHECK(own) blocked HR status updates.
drop policy if exists expenses_own on work.expenses;
create policy expenses_select on work.expenses
  for select to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy expenses_insert on work.expenses
  for insert to authenticated
  with check (person_id = identity.current_person_id());
create policy expenses_update on work.expenses
  for update to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy expenses_delete on work.expenses
  for delete to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));

drop policy if exists payslips_own on work.payslips;
create policy payslips_select on work.payslips
  for select to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy payslips_insert on work.payslips
  for insert to authenticated
  with check (identity.is_hr() and identity.same_org(person_id));
create policy payslips_update on work.payslips
  for update to authenticated
  using (identity.is_hr() and identity.same_org(person_id))
  with check (identity.is_hr() and identity.same_org(person_id));
create policy payslips_delete on work.payslips
  for delete to authenticated
  using (identity.is_hr() and identity.same_org(person_id));

drop policy if exists salary_requests_own on work.salary_requests;
create policy salary_requests_select on work.salary_requests
  for select to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy salary_requests_insert on work.salary_requests
  for insert to authenticated
  with check (person_id = identity.current_person_id());
create policy salary_requests_update on work.salary_requests
  for update to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy salary_requests_delete on work.salary_requests
  for delete to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));

drop policy if exists complaints_own on work.complaints;
create policy complaints_select on work.complaints
  for select to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy complaints_insert on work.complaints
  for insert to authenticated
  with check (person_id = identity.current_person_id());
create policy complaints_update on work.complaints
  for update to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy complaints_delete on work.complaints
  for delete to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));

drop policy if exists resignations_own on work.resignations;
create policy resignations_select on work.resignations
  for select to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy resignations_insert on work.resignations
  for insert to authenticated
  with check (person_id = identity.current_person_id());
create policy resignations_update on work.resignations
  for update to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy resignations_delete on work.resignations
  for delete to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));

drop policy if exists custom_field_values_own on work.custom_field_values;
create policy custom_field_values_select on work.custom_field_values
  for select to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy custom_field_values_insert on work.custom_field_values
  for insert to authenticated
  with check (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy custom_field_values_update on work.custom_field_values
  for update to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy custom_field_values_delete on work.custom_field_values
  for delete to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));

drop policy if exists offboarding_own on work.offboarding_checklists;
create policy offboarding_select on work.offboarding_checklists
  for select to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy offboarding_insert on work.offboarding_checklists
  for insert to authenticated
  with check (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy offboarding_update on work.offboarding_checklists
  for update to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy offboarding_delete on work.offboarding_checklists
  for delete to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));

drop policy if exists assets_own on work.assets;
create policy assets_select on work.assets
  for select to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy assets_insert on work.assets
  for insert to authenticated
  with check (identity.is_hr() and identity.same_org(person_id) or person_id = identity.current_person_id());
create policy assets_update on work.assets
  for update to authenticated
  using (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)))
  with check (person_id = identity.current_person_id() or (identity.is_hr() and identity.same_org(person_id)));
create policy assets_delete on work.assets
  for delete to authenticated
  using (identity.is_hr() and identity.same_org(person_id));
