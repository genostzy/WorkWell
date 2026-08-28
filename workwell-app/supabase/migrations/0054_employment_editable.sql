-- Let HR actually hold the employment record.
--
-- The record has always said "Held by HR. Ask them to correct anything
-- wrong" on the employee's own screen, and HR has never been able to
-- correct any of it. work.employment was granted select and nothing else:
-- no update policy, no update grant, no RPC. The only writer was
-- invite_person(), which sets a job title, a department and a start date
-- and leaves team, manager and location null forever. Every "—" on that
-- card was unreachable, not merely unfilled.
--
-- This is the missing write path, as an RPC rather than an update policy.
-- Both patterns exist in this codebase; the RPC is right here because the
-- rules are about more than the row being written — the manager has to be
-- a real colleague, and "the same person" has to be refused — and a
-- with-check expression is a poor place to say that and a worse place to
-- explain it to whoever tripped over it.

-- The view selects manager_name, so it has to go before the column can.
-- Recreated at the bottom, once there is a manager_id to build it from.
drop view public.employment;

-- A manager is a person, not a string.
--
-- manager_name was free text nobody could write, which meant no org chart,
-- no way to route anything to an actual manager, and no way to notice when
-- one leaves. Every existing row has it null, so there is nothing to
-- migrate and nothing to lose by dropping it.
alter table work.employment
  add column manager_id uuid references identity.people(id) on delete set null;

alter table work.employment
  drop column manager_name;

create index employment_manager_idx on work.employment (manager_id);

-- A holiday entitlement is a number of days in a year. Nought is a real
-- answer (a contractor), 365 is not a real answer but is a fine ceiling to
-- catch a stray keystroke before it becomes a leave balance.
alter table work.employment
  add constraint employment_entitlement_sane
  check (entitlement >= 0 and entitlement <= 365);

-- Nobody manages themselves. Worth a table constraint rather than only an
-- RPC check: this one has to hold whatever future path writes the row.
alter table work.employment
  add constraint employment_manager_not_self
  check (manager_id is null or manager_id <> person_id);

-- manager_name comes back as the manager's actual name, resolved rather
-- than stored, so it cannot drift out of date when somebody is renamed.
-- The employee's own card reads this column and needs no change.
--
-- Joined against public.people, not identity.people: `authenticated` has
-- no grant on the latter, and routing through the same view everything
-- else uses keeps one access path rather than opening a second. Both views
-- are security_invoker, so people RLS still applies at both levels — and
-- it already lets anyone read the names of their own org, which is exactly
-- the set of people who can be a manager here.
create view public.employment
  with (security_invoker = true)
  as select e.person_id, e.job_title, e.department, e.team,
            e.manager_id,
            m.full_name as manager_name,
            e.contract_type, e.location, e.started_on, e.entitlement
       from work.employment e
       left join public.people m on m.id = e.manager_id;

grant select on public.employment to authenticated;

/**
 * Write an employment record, as HR, for someone in your own org.
 *
 * Definer because work.employment stays select-only to everyone: there is
 * no update policy to widen, and no path to this data that is not this
 * function. It upserts rather than updates so a record that never got
 * created is still fixable from the same screen — an employee staring at a
 * missing record does not care which of the two it was.
 */
create or replace function public.hr_update_employment(
  p_person_id     uuid,
  p_job_title     text,
  p_department    text,
  p_team          text,
  p_manager_id    uuid,
  p_contract_type text,
  p_location      text,
  p_started_on    date,
  p_entitlement   int
) returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not identity.is_hr() then
    raise exception 'Only HR can change an employment record.';
  end if;

  if not identity.same_org(p_person_id) then
    raise exception 'That person is not in your organisation.';
  end if;

  -- Checked before the row is touched, so a mistyped manager does not
  -- half-apply an edit. same_org() is definer, so this answers honestly
  -- even for a person the caller could not otherwise select.
  if p_manager_id is not null then
    if p_manager_id = p_person_id then
      raise exception 'Somebody cannot be their own manager.';
    end if;
    if not identity.same_org(p_manager_id) then
      raise exception 'A manager has to be someone in your organisation.';
    end if;
  end if;

  -- The columns are not null, so a blank would be caught anyway -- but as a
  -- constraint violation, which reads as a fault rather than as the
  -- sentence a person needs.
  if coalesce(btrim(p_job_title), '') = '' then
    raise exception 'A job title is required.';
  end if;
  if coalesce(btrim(p_department), '') = '' then
    raise exception 'A department is required.';
  end if;
  if p_started_on is null then
    raise exception 'A start date is required.';
  end if;
  if p_entitlement is null or p_entitlement < 0 or p_entitlement > 365 then
    raise exception 'Leave entitlement has to be between 0 and 365 days.';
  end if;

  -- The optional text fields are stored as null rather than as '' when
  -- they are cleared, so "not recorded" is one state and not two. The
  -- employee's card renders null as an em dash; it would render '' as a
  -- blank cell, which reads as a rendering fault.
  insert into work.employment as e (
    person_id, job_title, department, team, manager_id,
    contract_type, location, started_on, entitlement
  )
  values (
    p_person_id,
    btrim(p_job_title),
    btrim(p_department),
    nullif(btrim(coalesce(p_team, '')), ''),
    p_manager_id,
    coalesce(nullif(btrim(coalesce(p_contract_type, '')), ''), 'Full time'),
    nullif(btrim(coalesce(p_location, '')), ''),
    p_started_on,
    p_entitlement
  )
  on conflict (person_id) do update set
    job_title     = excluded.job_title,
    department    = excluded.department,
    team          = excluded.team,
    manager_id    = excluded.manager_id,
    contract_type = excluded.contract_type,
    location      = excluded.location,
    started_on    = excluded.started_on,
    entitlement   = excluded.entitlement;
end;
$$;

revoke all on function public.hr_update_employment(
  uuid, text, text, text, uuid, text, text, date, int
) from public, anon;

grant execute on function public.hr_update_employment(
  uuid, text, text, text, uuid, text, text, date, int
) to authenticated;

-- Same reason as 0053: the API's schema cache has to be told that
-- manager_id and manager_name exist, and that hr_update_employment does.
notify pgrst, 'reload schema';
