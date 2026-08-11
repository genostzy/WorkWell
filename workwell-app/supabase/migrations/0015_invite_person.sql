-- Inviting someone.
--
-- Deliberately an RPC rather than insert policies. Creating a person means
-- writing three tables at once — the person, their roles, their employment
-- record — and any of those failing halfway would leave a half-made
-- colleague. A function makes it one transaction, and it means `identity`
-- needs no INSERT policy at all: the client cannot write these tables
-- directly, only ask for a well-formed invitation.
--
-- org_id is never taken from the caller. It is resolved from their own JWT,
-- so HR at one company physically cannot invite someone into another.
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

  if clean_mail = '' or position('@' in clean_mail) = 0 then
    raise exception 'a valid email address is required'
      using errcode = '22023';
  end if;

  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'a name is required'
      using errcode = '22023';
  end if;

  -- Email is unique per org, so re-inviting someone already here is a
  -- mistake worth naming rather than a duplicate row.
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

  -- Everyone is an employee. HR is additional, never instead: HR staff have
  -- their own wellbeing data like anyone else.
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
