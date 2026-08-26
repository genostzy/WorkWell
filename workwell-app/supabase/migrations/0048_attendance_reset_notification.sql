-- Attendance was the one decision-flow in the product that never notified
-- the person it was about. Leave, expense, payroll, complaint, and
-- resignation decisions all fire a notification; decide_attendance_reset()
-- (0031) was built after 0035 froze the notifications.kind list and nobody
-- added a kind for it, so the client had no value to insert even if it had
-- tried.
alter table work.notifications drop constraint notifications_kind_check;
alter table work.notifications add constraint notifications_kind_check
  check (kind in (
    'leave_decided', 'expense_decided', 'complaint_updated',
    'resignation_updated', 'salary_decided', 'warning_issued',
    'offboarding_updated', 'access_approved', 'access_declined',
    'attendance_reset_decided'
  ));
