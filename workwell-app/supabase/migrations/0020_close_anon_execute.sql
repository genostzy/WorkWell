-- Every RPC in this project ends with `revoke all on function ... from public`
-- and I read that, six times, as "no unauthenticated caller can execute this".
-- It never was.
--
-- Supabase ships an ALTER DEFAULT PRIVILEGES that grants EXECUTE on new
-- functions in public to anon, authenticated and service_role. That is a
-- direct grant to anon, not a grant to PUBLIC, so revoking from PUBLIC leaves
-- it untouched. Checked after adding 0019: all six functions — including
-- decide_access_request and set_person_access — were callable by anon.
--
-- Nothing was exploitable. Each one starts by resolving the caller, and anon
-- has no auth.uid(), so current_person_id() is null, is_hr() is false, and
-- every path raises 42501 before touching a row. The hole was that the line
-- meant to close the door was not the line closing it: the guarantee rested
-- entirely on each function body being written correctly, with no second
-- layer behind it. The next function written slightly differently would have
-- been the one that mattered.
--
-- Two parts, because either alone is incomplete: revoke what is already
-- granted, and stop the default from granting it again.

revoke execute on function public.save_check_in(smallint, smallint, smallint, text) from anon;
revoke execute on function public.invite_person(text, text, text, text, boolean) from anon;
revoke execute on function public.request_access(text, text) from anon;
revoke execute on function public.decide_access_request(uuid, boolean, text, text, boolean) from anon;
revoke execute on function public.set_person_access(uuid, boolean) from anon;
revoke execute on function public.set_person_status(uuid, text) from anon;

-- Default privileges are recorded per creating role, so this covers functions
-- created by the role migrations run as. A function created by some other
-- role would need its own revoke — which is what the assertion in
-- 10_boundary.sql is for, rather than trusting this to have been enough.
alter default privileges in schema public revoke execute on functions from anon;
