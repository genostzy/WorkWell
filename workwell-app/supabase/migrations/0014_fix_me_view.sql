-- public.me filtered on auth_user_id, but 0008 narrowed the column grant on
-- identity.people to (id, org_id, full_name, status). A security_invoker
-- view needs SELECT on every column it references, including ones that
-- appear only in the WHERE clause, so the view failed with 42501 and the
-- app rendered that as "this account is not linked to anyone".
--
-- Filtering by the resolver fixes it without widening the grant:
-- current_person_id() is security definer, so it reads auth_user_id inside
-- its own body, where the caller's privileges do not apply. auth_user_id
-- stays unreadable to authenticated, which is the point of 0008.
create or replace view public.me
  with (security_invoker = true)
  as select id, org_id, full_name, status
       from identity.people
      where id = identity.current_person_id();

grant select on public.me to authenticated;
