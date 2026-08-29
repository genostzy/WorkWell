-- Turning on Realtime for the four tables a second person's action should
-- show up on live: a notification landing, a task being assigned, ticked,
-- or removed, and a comment posted to a thread that is open.
--
-- Nothing here loosens what anybody can see. Postgres Changes evaluates
-- the existing RLS policies per subscriber -- current_person_id() and the
-- rest of identity.* all resolve from auth.uid(), the same value Realtime
-- authenticates the subscriber's socket with, so a change is only ever
-- broadcast to a client whose own row-level policies would have let it
-- read that row through a normal select. Nothing was added to a policy or
-- a grant to make this true; it falls out of the RLS already in place.
--
-- Two things per table:
--   1. Added to the supabase_realtime publication -- otherwise the change
--      never reaches the replication stream Realtime reads from at all.
--   2. Replica identity set to full. Postgres's default identity (the
--      primary key) is enough for an INSERT or an UPDATE, since the new
--      row always arrives complete regardless -- but a DELETE only ever
--      carries the primary key under the default, and RLS needs the
--      whole old row to evaluate a policy like `person_id = ...` against.
--      Employee-side deletes exist on three of these four tables (an
--      employee clears their own task, deletes their own comment; HR
--      removes an assigned task), so all three need it. notifications has
--      no delete policy at all -- nobody can delete one -- but full
--      identity is harmless there and keeps the four consistent.

alter table private.tasks       replica identity full;
alter table work.assigned_tasks replica identity full;
alter table work.task_comments  replica identity full;
alter table work.notifications  replica identity full;

alter publication supabase_realtime add table
  private.tasks,
  work.assigned_tasks,
  work.task_comments,
  work.notifications;
