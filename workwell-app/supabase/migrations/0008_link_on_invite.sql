-- Linking has to work from both directions. The auth.users trigger covers
-- "invited first, signed in later". This covers "signed in first, invited
-- later", which otherwise leaves a permanently orphaned account that no
-- later invitation can redeem.
--
-- BEFORE INSERT so the row is filled in place, with no second UPDATE and
-- no re-entrancy. Same unambiguity rule as the other direction: link only
-- on exactly one unclaimed match, and never steal an auth user another
-- person row already holds.
create or replace function identity.link_invited_person() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  candidate uuid;
  matches   int;
begin
  if new.auth_user_id is not null then
    return new;
  end if;

  select count(*) into matches
    from auth.users u
   where lower(u.email) = lower(new.email)
     and not exists (select 1 from identity.people p
                      where p.auth_user_id = u.id);

  if matches = 1 then
    select u.id into candidate
      from auth.users u
     where lower(u.email) = lower(new.email)
       and not exists (select 1 from identity.people p
                        where p.auth_user_id = u.id);
    new.auth_user_id := candidate;
    new.status       := 'active';
  end if;

  return new;
end;
$$;

revoke all on function identity.link_invited_person() from public;

drop trigger if exists on_person_invited on identity.people;
create trigger on_person_invited
  before insert on identity.people
  for each row execute function identity.link_invited_person();

-- The views never select email, but a table-wide grant leaves it
-- reachable. Narrow to the columns the app actually reads.
revoke select on identity.people from authenticated;
grant select (id, org_id, full_name, status) on identity.people to authenticated;
