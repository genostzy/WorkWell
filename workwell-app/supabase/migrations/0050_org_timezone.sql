-- A timezone for the organisation.
--
-- Shifts, quiet hours and meal windows are all wall-clock patterns, but
-- nothing in the schema said whose wall. Postgres compares them in UTC, so
-- for the demo org (UTC+8) every one of them was eight hours out on the
-- server: 0018_scheduler.sql documents exactly this for nudges ("times are
-- compared in UTC... needs a timezone column on identity.people"), and it is
-- why the time-in window added alongside the shift rosters had to be gated
-- in the client instead of in attendance_time_in().
--
-- On the org rather than the person. A roster is written in the workplace's
-- hours -- a 3pm shift is 3pm at the office whoever is working it -- and a
-- per-person zone would let two people on the same shift disagree about when
-- it starts. A travelling employee is a real case, but it is a different and
-- larger decision than this one, and guessing at it now would be worse than
-- leaving it.

alter table identity.orgs
  add column timezone text not null default 'Asia/Manila';

-- Validated by trigger, not CHECK: the only authority on what is a real zone
-- is pg_timezone_names, and reading it is stable rather than immutable, so a
-- CHECK constraint may not call it. A bad value here would not fail loudly --
-- `now() at time zone 'Manila/Asia'` throws at the moment someone clocks in,
-- not at the moment the typo was saved.
create or replace function identity.validate_org_timezone() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = new.timezone
  ) then
    raise exception '% is not a known IANA timezone name', new.timezone
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists orgs_timezone_valid on identity.orgs;
create trigger orgs_timezone_valid
  before insert or update of timezone on identity.orgs
  for each row execute function identity.validate_org_timezone();

-- The one place server-side code should ask. Falls back to UTC rather than
-- null so a caller with no org still gets a usable zone instead of an error
-- from `at time zone null`.
create or replace function identity.current_org_timezone() returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select o.timezone from identity.orgs o where o.id = identity.current_org_id()),
    'UTC'
  );
$$;

-- Readable by everyone in the org: the client has to compute the same
-- wall-clock minute the server does, or the two disagree about whether a
-- window is open and the person is told one thing and refused another.
-- orgs_read_own (0002) already scopes the row; the where is belt and braces
-- and makes this single-row by construction.
create view public.org
  with (security_invoker = true)
  as select id, name, timezone
       from identity.orgs
      where id = identity.current_org_id();

revoke insert, update, delete, truncate, references, trigger
  on public.org from authenticated, anon;
grant select on public.org to authenticated;

-- Changing it goes through a function rather than a table grant, the same
-- shape every other identity write here uses.
create or replace function public.set_org_timezone(p_timezone text) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not identity.is_hr() then
    raise exception 'only HR can change the organisation timezone'
      using errcode = '42501';
  end if;
  -- The trigger above rejects a name that is not real; nothing to repeat.
  update identity.orgs
     set timezone = btrim(p_timezone)
   where id = identity.current_org_id();
end;
$$;

revoke all on function public.set_org_timezone(text) from public;
grant execute on function public.set_org_timezone(text) to authenticated;
