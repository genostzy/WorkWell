-- The app reads through these, never the identity tables directly.
--
-- security_invoker is load-bearing. A Postgres view is security definer by
-- default, so without it these views would run as their owner and return
-- every row in the table — a hole straight through the RLS this plan just
-- built. With it, the underlying policies apply to the querying user.
create view public.people
  with (security_invoker = true)
  as select id, org_id, full_name, status
       from identity.people;

create view public.person_roles
  with (security_invoker = true)
  as select person_id, role
       from identity.person_roles;

grant select on public.people, public.person_roles to authenticated;
