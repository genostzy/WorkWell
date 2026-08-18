-- Which view the office opens to (room or list) belongs with the rest of
-- the account's display preferences (theme, contrast, motion, density) --
-- another thing chosen once that should not reset itself on every refresh,
-- sign-out, or trip to another screen.

alter table private.workspace_prefs
  add column home_view text not null default 'room'
              check (home_view in ('room', 'list'));

-- The view lists columns explicitly (0017) rather than select * -- add the
-- new one there too, or PostgREST never sees it. create or replace view is
-- safe here: the column is appended, not reordered, so the view's existing
-- grants (0017) carry over unchanged.
create or replace view public.workspace_prefs with (security_invoker = true) as
  select person_id, theme, contrast, motion, density, focus_one_question,
         hide_counts, plain_language, checkin_format, home_view
    from private.workspace_prefs;
