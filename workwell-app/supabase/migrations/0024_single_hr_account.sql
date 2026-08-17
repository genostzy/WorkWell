-- Enforce exactly one HR/admin account per organisation.
--
-- The product decision changed: an HR account no longer carries a private
-- plane of its own, and a private account can never carry HR. One account
-- is HR; everyone else is strictly private-plane. The app's "Give HR
-- access" control is removed to match, but a UI removal is not a
-- guarantee — the three functions below are the only ways any client can
-- ever grant the role, so the invariant is enforced here too.

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

  if p_person_id = me then
    raise exception 'you cannot change your own HR access' using errcode = '42501';
  end if;

  if p_is_hr then
    -- Exactly one HR account per org. Granting a second is not a state
    -- this product supports any more, so it never gets as far as a row.
    if exists (
      select 1 from identity.person_roles r
        join identity.people p on p.id = r.person_id
       where r.role = 'hr' and p.org_id = identity.current_org_id()
    ) then
      raise exception 'this organisation already has an HR account' using errcode = '23505';
    end if;

    insert into identity.person_roles (person_id, role)
    values (p_person_id, 'hr')
    on conflict do nothing;
  else
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


create or replace function public.provision_person(
  p_auth_user_id uuid,
  p_full_name    text,
  p_job_title    text default null,
  p_department   text default null,
  p_is_hr        boolean default false
) returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  caller_org uuid;
  v_email    text;
  new_id     uuid;
begin
  if not identity.is_hr() then
    raise exception 'only HR can create an account' using errcode = '42501';
  end if;

  caller_org := identity.current_org_id();

  if p_is_hr and exists (
    select 1 from identity.person_roles r
      join identity.people p on p.id = r.person_id
     where r.role = 'hr' and p.org_id = caller_org
  ) then
    raise exception 'this organisation already has an HR account' using errcode = '23505';
  end if;

  select email into v_email from auth.users where id = p_auth_user_id;
  if v_email is null then
    raise exception 'no such auth user' using errcode = '02000';
  end if;

  if exists (
    select 1 from identity.people
     where org_id = caller_org and lower(email) = lower(v_email)
  ) then
    raise exception 'that email is already on your organisation' using errcode = '23505';
  end if;

  if exists (select 1 from identity.people where auth_user_id = p_auth_user_id) then
    raise exception 'that account is already linked to a person' using errcode = '23505';
  end if;

  insert into identity.people
    (org_id, auth_user_id, email, full_name, status, must_change_password)
  values
    (caller_org, p_auth_user_id, lower(v_email), btrim(p_full_name), 'active', true)
  returning id into new_id;

  insert into identity.person_roles (person_id, role) values (new_id, 'employee');
  if p_is_hr then
    insert into identity.person_roles (person_id, role) values (new_id, 'hr');
  end if;

  if coalesce(btrim(p_job_title), '') <> ''
     and coalesce(btrim(p_department), '') <> '' then
    insert into work.employment (person_id, job_title, department, started_on)
    values (new_id, btrim(p_job_title), btrim(p_department), current_date);
  end if;

  return new_id;
end;
$$;

revoke all on function public.provision_person(uuid, text, text, text, boolean) from public;
grant execute on function public.provision_person(uuid, text, text, text, boolean) to authenticated;


create or replace function public.invite_person(
  p_email      text,
  p_full_name  text,
  p_job_title  text default null,
  p_department text default null,
  p_is_hr      boolean default false
) returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  caller_org uuid;
  new_id     uuid;
  clean_mail text := lower(btrim(p_email));
begin
  if not identity.is_hr() then
    raise exception 'only HR can invite people'
      using errcode = '42501';
  end if;

  caller_org := identity.current_org_id();
  if caller_org is null then
    raise exception 'this account is not linked to an organisation'
      using errcode = '42501';
  end if;

  if p_is_hr and exists (
    select 1 from identity.person_roles r
      join identity.people p on p.id = r.person_id
     where r.role = 'hr' and p.org_id = caller_org
  ) then
    raise exception 'this organisation already has an HR account' using errcode = '23505';
  end if;

  if clean_mail = '' or position('@' in clean_mail) = 0 then
    raise exception 'a valid email address is required'
      using errcode = '22023';
  end if;

  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'a name is required'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from identity.people
     where org_id = caller_org and lower(email) = clean_mail
  ) then
    raise exception 'that email is already on your organisation'
      using errcode = '23505';
  end if;

  insert into identity.people (org_id, email, full_name, status)
  values (caller_org, clean_mail, btrim(p_full_name), 'invited')
  returning id into new_id;

  insert into identity.person_roles (person_id, role) values (new_id, 'employee');
  if p_is_hr then
    insert into identity.person_roles (person_id, role) values (new_id, 'hr');
  end if;

  if coalesce(btrim(p_job_title), '') <> ''
     and coalesce(btrim(p_department), '') <> '' then
    insert into work.employment (person_id, job_title, department, started_on)
    values (new_id, btrim(p_job_title), btrim(p_department), current_date);
  end if;

  return new_id;
end;
$$;

revoke all on function public.invite_person(text, text, text, text, boolean) from public;
grant execute on function public.invite_person(text, text, text, text, boolean) to authenticated;
