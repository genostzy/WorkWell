-- Runs as definer because it writes to identity.people, which grants no
-- write policy to authenticated. Matching is on lowercased email, since
-- people type their address however they like.
create or replace function identity.link_auth_user() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update identity.people
     set auth_user_id = new.id,
         status       = 'active'
   where auth_user_id is null
     and lower(email) = lower(new.email);
  return new;
end;
$$;

revoke all on function identity.link_auth_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function identity.link_auth_user();
