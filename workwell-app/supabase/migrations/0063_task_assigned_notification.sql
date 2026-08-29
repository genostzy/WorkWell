-- Task assignment was the other decision-flow that never notified the
-- person it was about, and unlike 0048's attendance-reset gap this one
-- was not silent by omission: assign-tasks-client.tsx has inserted
-- kind = 'task_assigned' since 0055 added the tasks feature, and every
-- one of those inserts has been rejected by notifications_kind_check,
-- which 0048 last touched before task assignment existed and never
-- widened again. The task itself is still created either way -- the
-- insert into work.assigned_tasks and the insert into work.notifications
-- are two separate statements -- so nothing user-facing threw an error;
-- HR saw the task land in the list, and the person it was for saw
-- nothing until they happened to open Tasks themselves.

alter table work.notifications drop constraint notifications_kind_check;
alter table work.notifications add constraint notifications_kind_check
  check (kind in (
    'leave_decided', 'expense_decided', 'complaint_updated',
    'resignation_updated', 'salary_decided', 'warning_issued',
    'offboarding_updated', 'access_approved', 'access_declined',
    'attendance_reset_decided', 'task_assigned'
  ));
