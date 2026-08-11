-- Access requests.
--
-- Anyone can obtain an account — Supabase will send a magic link to any
-- address — but an account is not access. Until someone is linked to a
-- person row they resolve to nobody and see nothing, which is the designed
-- outcome. This gives that state somewhere to go: the person asks, and HR
-- decides.
--
-- The linking trigger from 0008 does the hard part. Creating the person row
-- finds their existing auth user by email and links it, so approving a
-- request signs them straight in on their next visit.

create table identity.access_requests (
  id           uuid primary key default gen_random_uuid(),
  -- One open request per account. A second attempt updates the first
  -- rather than filling HR's queue with duplicates.
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text not null,
  note         text,
  status       text not null default 'pending'
               check (status in ('pending','approved','declined')),
  decided_by   uuid references identity.people(id) on delete set null,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index access_requests_status_idx on identity.access_requests (status, created_at);

alter table identity.access_requests enable row level security;

-- You can see your own request. HR can see every pending one.
--
-- Worth naming: a request has no org until it is approved, so HR at any
-- organisation can see any pending request. With one organisation that is
-- correct. With several it would need an org hint — a domain match or a
-- joining code — before this is multi-tenant safe.
create policy access_requests_read on identity.access_requests
  for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or identity.is_hr()
  );

grant select on identity.access_requests to authenticated;

create view public.access_requests
  with (security_invoker = true)
  as select id, email, full_name, note, status, created_at
       from identity.access_requests;

grant select on public.access_requests to authenticated;

-- Asking. The email is taken from the account, never from the form, so a
-- request cannot be raised on someone else's behalf.
create or replace function public.request_access(
  p_full_name text,
  p_note      text default null
) returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  uid  uuid := (select auth.uid());
  mail text;
begin
  if uid is null then
    raise exception 'you must be signed in' using errcode = '42501';
  end if;

  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'a name is required' using errcode = '22023';
  end if;

  if identity.current_person_id() is not null then
    raise exception 'this account already has access' using errcode = '23505';
  end if;

  select email into mail from auth.users where id = uid;

  insert into identity.access_requests (auth_user_id, email, full_name, note)
  values (uid, lower(mail), btrim(p_full_name), nullif(btrim(p_note), ''))
  on conflict (auth_user_id) do update
    set full_name  = excluded.full_name,
        note       = excluded.note,
        status     = 'pending',
        decided_by = null,
        decided_at = null,
        created_at = now();
end;
$$;

revoke all on function public.request_access(text, text) from public;
grant execute on function public.request_access(text, text) to authenticated;

-- Deciding. One transaction: the person, their roles, their employment and
-- the request's own status all move together, so a half-approved colleague
-- cannot exist.
create or replace function public.decide_access_request(
  p_request_id uuid,
  p_approve    boolean,
  p_job_title  text default null,
  p_department text default null,
  p_is_hr      boolean default false
) returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  req        identity.access_requests%rowtype;
  caller_org uuid;
  new_id     uuid;
begin
  if not identity.is_hr() then
    raise exception 'only HR can decide access requests' using errcode = '42501';
  end if;

  caller_org := identity.current_org_id();

  select * into req from identity.access_requests where id = p_request_id;
  if not found then
    raise exception 'no such request' using errcode = '02000';
  end if;
  if req.status <> 'pending' then
    raise exception 'that request has already been decided' using errcode = '23505';
  end if;

  if not p_approve then
    update identity.access_requests
       set status = 'declined',
           decided_by = identity.current_person_id(),
           decided_at = now()
     where id = p_request_id;
    return null;
  end if;

  if exists (
    select 1 from identity.people
     where org_id = caller_org and lower(email) = lower(req.email)
  ) then
    raise exception 'that email is already on your organisation' using errcode = '23505';
  end if;

  -- The BEFORE INSERT trigger on identity.people links this row to the
  -- requester's existing auth user and flips it to active, so they are
  -- signed in the moment they return.
  insert into identity.people (org_id, email, full_name, status)
  values (caller_org, lower(req.email), req.full_name, 'invited')
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

  update identity.access_requests
     set status = 'approved',
         decided_by = identity.current_person_id(),
         decided_at = now()
   where id = p_request_id;

  return new_id;
end;
$$;

revoke all on function public.decide_access_request(uuid, boolean, text, text, boolean) from public;
grant execute on function public.decide_access_request(uuid, boolean, text, text, boolean) to authenticated;
