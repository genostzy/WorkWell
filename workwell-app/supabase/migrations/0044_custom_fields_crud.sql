-- Custom fields could only ever be added, never corrected or removed —
-- 0037 granted select and insert on work.custom_fields and stopped there.
-- Unlike News or Policies, there is nothing downstream to cascade: no
-- per-employee value has ever existed to invalidate (that side was
-- deliberately never built, see 0037's own comment), so a definition is
-- safe to edit or delete outright.
create policy custom_fields_update on work.custom_fields
  for update to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id())
  with check (identity.is_hr() and org_id = identity.current_org_id());

create policy custom_fields_delete on work.custom_fields
  for delete to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id());

revoke truncate, references, trigger
  on work.custom_fields from authenticated, anon;
grant update, delete on work.custom_fields to authenticated;

revoke truncate, references, trigger
  on public.custom_fields from authenticated, anon;
grant update, delete on public.custom_fields to authenticated;
