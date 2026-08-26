-- Two self-update policies were scoped to a row, not to the column the app
-- actually means to let someone change. RLS can only gate which rows an
-- update reaches, not which columns within them -- a policy of
-- `using (person_id = current_person_id())` with no further check lets a
-- direct API call rewrite any column on that row, not just the one field
-- the client UI ever sends.
--
-- work.assets: an employee reporting a fault should only ever be able to
-- set issue_reported/issue_note -- not condition, tag, asset_type, or
-- issued_on, all of which are HR's inventory record, not theirs to edit.
--
-- work.notifications: marking your own notification read should only ever
-- touch `read` -- not title, body, kind, or link, which would let someone
-- forge the content of their own notification history.
--
-- Both guarded the same way: a trigger that lets HR's own broader update
-- policy through untouched, and rejects any other update that touches a
-- column outside the one it's meant to.

create or replace function work.guard_assets_self_update() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if identity.is_hr() then
    return new;
  end if;

  if new.person_id  is distinct from old.person_id
     or new.tag        is distinct from old.tag
     or new.asset_type is distinct from old.asset_type
     or new.issued_on  is distinct from old.issued_on
     or new.condition  is distinct from old.condition
  then
    raise exception 'you may only report an issue, not edit this record'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists assets_self_update_guard on work.assets;
create trigger assets_self_update_guard
  before update on work.assets
  for each row
  execute function work.guard_assets_self_update();

create or replace function work.guard_notifications_self_update() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.person_id  is distinct from old.person_id
     or new.kind       is distinct from old.kind
     or new.title      is distinct from old.title
     or new.body       is distinct from old.body
     or new.link       is distinct from old.link
     or new.created_at is distinct from old.created_at
  then
    raise exception 'you may only mark a notification read'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_self_update_guard on work.notifications;
create trigger notifications_self_update_guard
  before update on work.notifications
  for each row
  execute function work.guard_notifications_self_update();
