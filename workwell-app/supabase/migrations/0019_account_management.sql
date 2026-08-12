-- Account management for HR.
--
-- Approving a request was the only account decision that existed. Everything
-- afterwards — someone leaving, someone joining the HR team, someone's HR
-- access being taken back — had no route but editing rows by hand.
--
-- Two writes, both narrow, both security definer for the same reason
-- decide_access_request is: identity stays closed to the API, and the rules
-- live in one place instead of being spread across policies the client could
-- work around.

-- HR could not see who else was HR. roles_read_own returns your own roles and
-- nothing else, which is right for an employee and useless for the person
-- administering accounts. A role is a work-plane fact — it says what someone
-- can open, never how they are — so this widens nothing that matters.
create policy roles_read_by_hr on identity.person_roles
  for select to authenticated
  using (identity.is_hr() and identity.same_org(person_id));


-- Granting or taking back HR access.
create or replace function public.set_person_access(
  p_person_id uuid,
  p_is_hr     boolean
) returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  me uuid := identity.current_person_id();
begin
  if not identity.is_hr() then
    raise exception 'only HR can change access' using errcode = '42501';
  end if;

  if not identity.same_org(p_person_id) then
    raise exception 'that person is not at your organisation' using errcode = '42501';
  end if;

  -- Changing your own HR access is how an organisation ends up with an
  -- administrator who can no longer administer. Someone else with the role
  -- has to do it, which also means the change has a second pair of eyes.
  if p_person_id = me then
    raise exception 'you cannot change your own HR access' using errcode = '42501';
  end if;

  if p_is_hr then
    insert into identity.person_roles (person_id, role)
    values (p_person_id, 'hr')
    on conflict do nothing;
  else
    -- The org must keep at least one. Locking everybody out of HR is not a
    -- state anyone can recover from inside the product.
    if (select count(*) from identity.person_roles r
          join identity.people p on p.id = r.person_id
         where r.role = 'hr'
           and p.org_id = identity.current_org_id()
           and r.person_id <> p_person_id) = 0 then
      raise exception 'that is the last HR account — give someone else access first'
        using errcode = '23503';
    end if;

    delete from identity.person_roles
     where person_id = p_person_id and role = 'hr';
  end if;
end;
$$;

revoke all on function public.set_person_access(uuid, boolean) from public;
grant execute on function public.set_person_access(uuid, boolean) to authenticated;


-- Closing or reopening an account.
--
-- 'left' is deliberately not a delete. Deleting the person row would cascade
-- their private history away, and someone's own check-ins are theirs — not
-- HR's to destroy on their way out.
--
-- Be precise about what this does and does not do. current_person_id() does
-- not filter on status, so a closed account still resolves and its own
-- policies still hold; what stops is the app, which reads status from
-- public.me and shows a closed-account screen instead of opening the room.
-- That is a product gate, not a database one. Cutting them off in the
-- resolver would revoke their access to their own private plane, which is a
-- different and much larger decision than "this person has left".
create or replace function public.set_person_status(
  p_person_id uuid,
  p_status    text
) returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  me uuid := identity.current_person_id();
begin
  if not identity.is_hr() then
    raise exception 'only HR can change an account' using errcode = '42501';
  end if;

  if not identity.same_org(p_person_id) then
    raise exception 'that person is not at your organisation' using errcode = '42501';
  end if;

  if p_person_id = me then
    raise exception 'you cannot close your own account' using errcode = '42501';
  end if;

  if p_status not in ('active', 'left') then
    raise exception 'status must be active or left' using errcode = '22023';
  end if;

  update identity.people
     set status = p_status
   where id = p_person_id;
end;
$$;

revoke all on function public.set_person_status(uuid, text) from public;
grant execute on function public.set_person_status(uuid, text) to authenticated;
