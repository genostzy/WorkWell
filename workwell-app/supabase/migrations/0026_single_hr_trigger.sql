-- 0024 enforces "exactly one HR account per org" inside three application
-- entry points (set_person_access, provision_person, invite_person), and
-- its own comment admits the limit of that approach: those three
-- functions are only "the only ways any client can ever grant the role"
-- as long as nothing else ever writes to identity.person_roles. A data
-- fix, an admin console query, or a future RPC that inserts directly
-- would bypass all three checks silently.
--
-- A trigger on the table itself closes that gap — it fires on every
-- insert into identity.person_roles, from any writer, present or future.
-- Not a plain unique index: the constraint spans two tables (role lives
-- on person_roles, org_id lives on people), which a unique index can't
-- express without a denormalised column. AFTER, not BEFORE: simplest to
-- let the row land and then count, rather than replicate the counting
-- logic against a not-yet-committed insert.

create or replace function identity.enforce_single_hr() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_count  int;
begin
  if new.role <> 'hr' then
    return new;
  end if;

  select org_id into v_org_id from identity.people where id = new.person_id;

  select count(*) into v_count
    from identity.person_roles r
    join identity.people p on p.id = r.person_id
   where r.role = 'hr' and p.org_id = v_org_id;

  if v_count > 1 then
    raise exception 'this organisation already has an HR account' using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists single_hr_per_org on identity.person_roles;
create trigger single_hr_per_org
  after insert on identity.person_roles
  for each row
  when (new.role = 'hr')
  execute function identity.enforce_single_hr();
