-- 0035: Single-HR race fix — lock the org before counting.

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
  if v_org_id is null then
    return new;
  end if;

  -- Serialize concurrent HR inserts for the same org. pg_advisory_xact_lock
  -- is transaction-scoped, so two concurrent inserts for the same org hit
  -- this sequentially and the second sees the committed count.
  perform pg_advisory_xact_lock(hashtext(v_org_id::text));

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
