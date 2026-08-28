-- The text of a policy.
--
-- work.policies has carried a title and a date since 0024 and nothing to
-- read. The screen asks people to acknowledge each one, which meant
-- acknowledging a heading — the acknowledgement was real and the policy
-- behind it did not exist anywhere in the system.

alter table work.policies
  add column body text;

-- Appended at the end of the view's columns, which is the one shape
-- create or replace view accepts: it refuses a reordered or renamed
-- column list and will only take new ones on the end.
create or replace view public.policies with (security_invoker = true) as
  select id, org_id, title, updated_on, created_at, body
    from work.policies;

notify pgrst, 'reload schema';
