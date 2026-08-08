/* ==========================================================================
   WorkWell — Work plane data

   The signed-in employee's OWN employment record. Not the directory.

   Self-service returns only your own row, which is why this is a separate
   file from hr-data.js rather than a filtered view of it: opening My Leave
   must not put everyone else's leave balances in your browser.

   This is employment data, so the employer legitimately holds it — it is not
   the private plane. Wellbeing lives in private-data.js and is not here.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

const ME = {
  id: 'celine',
  name: 'Celine Nolasco',
  initials: 'CN',
  title: 'Software Engineer',
  dept: 'Engineering',
  team: 'Platform',
  manager: 'Priya Nair',
  type: 'Full time',
  location: 'Manila',
  started: '2024-03-04',
  email: 'celine.nolasco@northwind.example',
  status: 'Active',
  leave: { entitlement: 20, taken: 8, booked: 2 },
};

const LEAVE_TYPES = ['Annual leave', 'Sick leave', 'Unpaid leave', 'Bereavement'];

const MY_LEAVE = [
  { type: 'Annual leave', from: '2026-09-07', to: '2026-09-08', days: 2, status: 'Pending' },
  { type: 'Annual leave', from: '2026-05-19', to: '2026-05-23', days: 5, status: 'Approved' },
  { type: 'Sick leave',   from: '2026-03-11', to: '2026-03-11', days: 1, status: 'Approved' },
  { type: 'Annual leave', from: '2026-01-06', to: '2026-01-08', days: 3, status: 'Approved' },
];

const MY_DOCUMENTS = [
  { name: 'Employment contract',  kind: 'Contract', date: '2024-03-04' },
  { name: 'Payslip — July 2026',  kind: 'Payslip',  date: '2026-07-25' },
  { name: 'Payslip — June 2026',  kind: 'Payslip',  date: '2026-06-25' },
  { name: 'Payslip — May 2026',   kind: 'Payslip',  date: '2026-05-25' },
  { name: 'Mid-year review 2025', kind: 'Review',   date: '2025-08-19' },
];

const fmtDate = (iso) => new Date(iso + 'T00:00:00')
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtRange = (a, b) => (a === b ? fmtDate(a) : `${fmtDate(a)} – ${fmtDate(b)}`);

WW.work = { ME, LEAVE_TYPES, MY_LEAVE, MY_DOCUMENTS, fmtDate, fmtRange };

})(window.WW);
