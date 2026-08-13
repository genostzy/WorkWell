-- HR-provisioned password accounts.
--
-- Replaces magic-link sign-in and self-service access requests with HR
-- creating the account directly. See
-- docs/superpowers/specs/2026-08-12-hr-provisioned-password-accounts-design.md.

-- ------------------------------------------------------------- The flag

alter table identity.people
  add column must_change_password boolean not null default true;

-- ------------------------------------------------------- Dead machinery

-- These linked an auth.users row to an identity.people row created
-- independently, in either order, by different actors — true when a
-- person could sign in via magic link before HR ever heard of them. From
-- here on HR creates both in one transaction and sets auth_user_id
-- directly, so neither trigger has a remaining case to handle.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_person_invited on identity.people;
drop function if exists identity.link_auth_user();
drop function if exists identity.link_invited_person();

drop function if exists public.decide_access_request(uuid, boolean, text, text, boolean);
drop function if exists public.request_access(text, text);
drop view if exists public.access_requests;
drop table if exists identity.access_requests;

-- ----------------------------------------------------------- Provisioning

-- decide_access_request's guts, minus the request-row bookkeeping: the
-- auth user already exists by the time this is called (the caller made
-- it moments ago via the Admin API), so email is read from auth.users
-- rather than trusted from a request row, and auth_user_id is set at
-- insert rather than left for a trigger to fill in.
create function public.provision_person(
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

-- Called before the Admin API resets an existing person's password. Returns
-- the auth_user_id the caller needs for that call, and flips the flag in
-- the same transaction so a crash between the two never leaves an account
-- silently un-flagged after its password changed underneath it.
create function public.begin_password_reset(p_person_id uuid) returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  me      uuid := identity.current_person_id();
  auth_id uuid;
begin
  if not identity.is_hr() then
    raise exception 'only HR can reset a password' using errcode = '42501';
  end if;
  if not identity.same_org(p_person_id) then
    raise exception 'that person is not at your organisation' using errcode = '42501';
  end if;
  if p_person_id = me then
    raise exception 'you cannot reset your own password here' using errcode = '42501';
  end if;

  update identity.people
     set must_change_password = true
   where id = p_person_id
  returning auth_user_id into auth_id;

  if auth_id is null then
    raise exception 'that account has no sign-in linked' using errcode = '02000';
  end if;

  return auth_id;
end;
$$;

revoke all on function public.begin_password_reset(uuid) from public;
grant execute on function public.begin_password_reset(uuid) to authenticated;

-- Called by the person themselves, once they have set a real password.
-- Clears only the caller's own flag — there is no argument to target
-- anyone else's.
create function public.clear_password_change_flag() returns void
language plpgsql
security definer
set search_path to ''
as $$
declare me uuid := identity.current_person_id();
begin
  if me is null then
    raise exception 'this account is not linked to a person' using errcode = '42501';
  end if;
  update identity.people set must_change_password = false where id = me;
end;
$$;

revoke all on function public.clear_password_change_flag() from public;
grant execute on function public.clear_password_change_flag() to authenticated;

-- The middleware gate reads this on every authenticated request, so it
-- rides on the view that already exists for exactly that shape of read
-- rather than adding a second one.
create or replace view public.me with (security_invoker = true) as
  select id, org_id, full_name, status, must_change_password
    from identity.people
   where id = identity.current_person_id();

-- security_invoker means this view runs as the caller, who needs SELECT on
-- every column it reads — including this one, now that it is part of the
-- select list above. identity.people's grant to authenticated was narrowed
-- to four named columns during an earlier review; the same shape of bug it
-- caused then (public.me returning 42501 for the account it exists to
-- serve) is what a missing grant here would cause again.
grant select (must_change_password) on identity.people to authenticated;
