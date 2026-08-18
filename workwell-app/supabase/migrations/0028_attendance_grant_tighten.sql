-- 0027 said "SELECT only" but Supabase's default privileges for the public
-- schema grant `authenticated` full INSERT/UPDATE/DELETE on any new table
-- or view regardless of what that migration explicitly granted. RLS on
-- private.attendance already blocks it -- there is no insert/update/delete
-- policy, so both the view and the table default-deny those commands
-- either way -- but the grant not matching the stated intent is worth
-- closing rather than leaving as a second, unnecessary door that happens
-- to be locked. Explicit revoke, same belt-and-suspenders reasoning as
-- 0026's single-HR trigger.

revoke insert, update, delete, truncate, references, trigger
  on public.attendance from authenticated, anon;

revoke insert, update, delete, truncate, references, trigger
  on private.attendance from authenticated, anon;
