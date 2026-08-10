-- Both resolvers are security definer so their bodies run without RLS.
-- That is what breaks the recursion a policy on identity.people would
-- otherwise cause. search_path is pinned to empty and every reference is
-- schema-qualified.
create or replace function identity.current_person_id() returns uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select id from identity.people
   where auth_user_id = (select auth.uid())
$$;

create or replace function identity.current_org_id() returns uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select org_id from identity.people
   where auth_user_id = (select auth.uid())
$$;

revoke all on function identity.current_person_id() from public;
revoke all on function identity.current_org_id()    from public;
grant execute on function identity.current_person_id() to authenticated;
grant execute on function identity.current_org_id()    to authenticated;
