alter table identity.orgs         enable row level security;
alter table identity.people       enable row level security;
alter table identity.person_roles enable row level security;

-- Each policy calls a resolver instead of inlining the lookup. Inlining
-- "select org_id from identity.people ..." inside a policy ON
-- identity.people recurses: the inner read re-triggers the same policy,
-- and it fails at query time with a stack-depth error rather than at
-- migration time.
create policy people_read_own_org on identity.people
  for select to authenticated
  using (org_id = identity.current_org_id());

create policy roles_read_own on identity.person_roles
  for select to authenticated
  using (person_id = identity.current_person_id());

create policy orgs_read_own on identity.orgs
  for select to authenticated
  using (id = identity.current_org_id());

-- Read-only for signed-in users in this slice. Invitation writes arrive
-- in slice D; the sign-in trigger writes as security definer.
grant select on identity.orgs, identity.people, identity.person_roles
  to authenticated;
