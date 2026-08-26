-- Same defect as 0046, found by checking every other "self may act on their
-- own submitted request" table for the same shape: resignations_withdraw's
-- with_check only reconfirms person_id, so a direct API call under an
-- employee's own session could set status to 'Acknowledged' (skipping HR's
-- decision entirely), backdate last_day, rewrite reason, or even forge
-- decided_by/decided_at. leave_requests, expenses, payroll_requests and
-- complaints have no self-update path at all -- only HR's is_hr()-gated
-- decide policy -- so resignations is the only table in this family that
-- needed this.
create or replace function work.guard_resignations_self_update() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if identity.is_hr() then
    return new;
  end if;

  if new.person_id  is distinct from old.person_id
     or new.last_day   is distinct from old.last_day
     or new.reason     is distinct from old.reason
     or new.decided_by is distinct from old.decided_by
     or new.decided_at is distinct from old.decided_at
     or new.status is distinct from 'Withdrawn'
  then
    raise exception 'you may only withdraw your own resignation'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists resignations_self_update_guard on work.resignations;
create trigger resignations_self_update_guard
  before update on work.resignations
  for each row
  execute function work.guard_resignations_self_update();
