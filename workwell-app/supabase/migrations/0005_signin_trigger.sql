-- Runs as definer because it writes to identity.people, which grants no
-- write policy to authenticated. Matching is on lowercased email, since
-- people type their address however they like.
--
-- The count guard is load-bearing. Email is unique per org, not globally,
-- so one address can be invited by two orgs. A bare UPDATE would match
-- both rows, and the second assignment would violate the unique
-- constraint on auth_user_id — aborting the auth.users insert that fired
-- this trigger, so that person could never sign in at all.
--
-- Link only when the match is unambiguous. Otherwise link nobody: the
-- account resolves to no person and sees nothing, which is already the
-- designed outcome for an uninvited sign-in. Picking one org by timing
-- would silently place someone in an employer's tenant by coincidence,
-- which this product must never do.
create or replace function identity.link_auth_user() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  matches int;
begin
  select count(*) into matches
    from identity.people
   where auth_user_id is null
     and lower(email) = lower(new.email);

  if matches = 1 then
    update identity.people
       set auth_user_id = new.id,
           status       = 'active'
     where auth_user_id is null
       and lower(email) = lower(new.email);
  end if;

  return new;
end;
$$;

revoke all on function identity.link_auth_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function identity.link_auth_user();
