/* ==========================================================================
   WorkWell — HR data (system of record)

   EMPLOYMENT data only. Job, leave, reviews, documents, onboarding.

   This file must never carry wellbeing data. No mood, no check-ins, no
   stress or energy, no boundary activity, no nudge history. Those live on
   the private plane and are structurally unavailable here — that separation
   is the whole product, and adding an HR system of record does not soften it.

   An HR manager legitimately sees that Celine has 12 days of leave left.
   They never see how her week felt.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

/* The mirror of the guard in private-data.js. This file holds the whole
 * directory — everyone's job, manager and leave balance — so an employee
 * account must not download it just by opening an HR URL. */
try {
  const u = JSON.parse(localStorage.getItem('ww.user') || 'null');
  if (u && u.plane !== 'hr') return;
} catch (e) { /* no storage — fall through */ }

/* ------------------------------------------------------------- Directory */

const PEOPLE = [
  { id: 'celine',  name: 'Celine Nolasco', initials: 'CN', title: 'Software Engineer',
    dept: 'Engineering', team: 'Platform', manager: 'Priya Nair', started: '2024-03-04',
    email: 'celine.nolasco@northwind.example', location: 'Manila', type: 'Full time',
    status: 'Active', leave: { entitlement: 20, taken: 8, booked: 2 } },
  { id: 'priya',   name: 'Priya Nair', initials: 'PN', title: 'Engineering Lead',
    dept: 'Engineering', team: 'Platform', manager: 'Wilson Dayrit', started: '2021-06-14',
    email: 'priya.nair@northwind.example', location: 'Manila', type: 'Full time',
    status: 'Active', leave: { entitlement: 24, taken: 11, booked: 0 } },
  { id: 'marco',   name: 'Marco Reyes', initials: 'MR', title: 'Senior Engineer',
    dept: 'Engineering', team: 'Web', manager: 'Priya Nair', started: '2022-09-01',
    email: 'marco.reyes@northwind.example', location: 'Cebu', type: 'Full time',
    status: 'Active', leave: { entitlement: 20, taken: 4, booked: 5 } },
  { id: 'sam',     name: 'Sam Okonkwo', initials: 'SO', title: 'Product Designer',
    dept: 'Design', team: 'Product Design', manager: 'Wilson Dayrit', started: '2023-01-16',
    email: 'sam.okonkwo@northwind.example', location: 'Remote', type: 'Full time',
    status: 'Active', leave: { entitlement: 20, taken: 15, booked: 0 } },
  { id: 'jamie',   name: 'Jamie Lim', initials: 'JL', title: 'Support Specialist',
    dept: 'Support', team: 'Support Tier 1', manager: 'Wilson Dayrit', started: '2025-11-03',
    email: 'jamie.lim@northwind.example', location: 'Manila', type: 'Full time',
    status: 'Onboarding', leave: { entitlement: 20, taken: 0, booked: 0 } },
  { id: 'nadia',   name: 'Nadia Farrell', initials: 'NF', title: 'Data Analyst',
    dept: 'Data', team: 'Data & Analytics', manager: 'Wilson Dayrit', started: '2023-08-21',
    email: 'nadia.farrell@northwind.example', location: 'Remote', type: 'Part time',
    status: 'Active', leave: { entitlement: 12, taken: 3, booked: 1 } },
  { id: 'tom',     name: 'Tom Alvarez', initials: 'TA', title: 'Account Executive',
    dept: 'Sales', team: 'SMB', manager: 'Wilson Dayrit', started: '2022-02-07',
    email: 'tom.alvarez@northwind.example', location: 'Manila', type: 'Full time',
    status: 'Active', leave: { entitlement: 20, taken: 18, booked: 2 } },
  { id: 'wilson',  name: 'Wilson Dayrit', initials: 'WD', title: 'HR Manager',
    dept: 'People Ops', team: 'People Ops', manager: '—', started: '2020-04-06',
    email: 'wilson.dayrit@northwind.example', location: 'Manila', type: 'Full time',
    status: 'Active', leave: { entitlement: 24, taken: 9, booked: 0 } },
];

/* ----------------------------------------------------------------- Leave */

const LEAVE_TYPES = ['Annual leave', 'Sick leave', 'Unpaid leave', 'Bereavement'];

const LEAVE = [
  { id: 'lv-1', person: 'marco',  type: 'Annual leave', from: '2026-08-17', to: '2026-08-21',
    days: 5, status: 'Pending',  note: 'Family trip, booked in April.' },
  { id: 'lv-2', person: 'celine', type: 'Annual leave', from: '2026-09-07', to: '2026-09-08',
    days: 2, status: 'Pending',  note: '' },
  { id: 'lv-3', person: 'nadia',  type: 'Sick leave',   from: '2026-08-04', to: '2026-08-04',
    days: 1, status: 'Pending',  note: '' },
  { id: 'lv-4', person: 'tom',    type: 'Annual leave', from: '2026-08-25', to: '2026-08-26',
    days: 2, status: 'Approved', note: '' },
  { id: 'lv-5', person: 'sam',    type: 'Annual leave', from: '2026-07-14', to: '2026-07-18',
    days: 5, status: 'Approved', note: '' },
  { id: 'lv-6', person: 'priya',  type: 'Unpaid leave', from: '2026-06-02', to: '2026-06-03',
    days: 2, status: 'Declined', note: 'Clashed with the release freeze.' },
];

/* ----------------------------------------------------------- Performance */

const REVIEW_CYCLE = { name: 'Mid-year 2026', opens: '2026-07-01', closes: '2026-08-31' };

const REVIEWS = [
  { person: 'celine', self: 'Submitted',   manager: 'In progress', due: '2026-08-22' },
  { person: 'marco',  self: 'Submitted',   manager: 'Submitted',   due: '2026-08-22' },
  { person: 'priya',  self: 'In progress', manager: 'Not started', due: '2026-08-29' },
  { person: 'sam',    self: 'Not started', manager: 'Not started', due: '2026-08-29' },
  { person: 'nadia',  self: 'Submitted',   manager: 'Submitted',   due: '2026-08-15' },
  { person: 'tom',    self: 'Not started', manager: 'Not started', due: '2026-08-29' },
];

/* Goals are the employee's own objectives — work output, never wellbeing. */
const GOALS = [
  { title: 'Ship the migration tooling', due: 'Q3 2026', progress: 70 },
  { title: 'Mentor one junior engineer', due: 'Q3 2026', progress: 45 },
  { title: 'Cut build times by a third', due: 'Q4 2026', progress: 20 },
];

/* ------------------------------------------------------------ Onboarding */

const ONBOARDING = [
  {
    person: 'jamie', started: '2025-11-03', buddy: 'Marco Reyes',
    tasks: [
      { label: 'Signed contract returned',      owner: 'HR',      done: true },
      { label: 'Right-to-work check',           owner: 'HR',      done: true },
      { label: 'Payroll details submitted',     owner: 'Jamie',   done: true },
      { label: 'Laptop and accounts issued',    owner: 'IT',      done: true },
      { label: 'Manager intro scheduled',       owner: 'Manager', done: false },
      { label: 'Policy acknowledgements',       owner: 'Jamie',   done: false },
      { label: 'First-week check-in booked',    owner: 'HR',      done: false },
    ],
  },
];

/* ------------------------------------------------------------- Documents */

const POLICIES = [
  { name: 'Employee handbook',        updated: '2026-01-12', ack: true },
  { name: 'Code of conduct',          updated: '2025-11-02', ack: true },
  { name: 'Leave and absence policy', updated: '2026-04-30', ack: true },
  { name: 'Right to disconnect',      updated: '2026-06-18', ack: false },
  { name: 'Data protection notice',   updated: '2026-02-09', ack: false },
];

const MY_DOCUMENTS = [
  { name: 'Employment contract',    kind: 'Contract', date: '2024-03-04' },
  { name: 'Payslip — July 2026',    kind: 'Payslip',  date: '2026-07-25' },
  { name: 'Payslip — June 2026',    kind: 'Payslip',  date: '2026-06-25' },
  { name: 'Payslip — May 2026',     kind: 'Payslip',  date: '2026-05-25' },
  { name: 'Mid-year review 2025',   kind: 'Review',   date: '2025-08-19' },
];

/* ------------------------------------------------------------- Helpers */

const byId = (id) => PEOPLE.find((p) => p.id === id);

const fmtDate = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtRange = (a, b) => (a === b ? fmtDate(a) : `${fmtDate(a)} – ${fmtDate(b)}`);

/** Whole-company headline counts for the HR overview. */
function hrSummary() {
  return {
    headcount: PEOPLE.length,
    onboarding: PEOPLE.filter((p) => p.status === 'Onboarding').length,
    pendingLeave: LEAVE.filter((l) => l.status === 'Pending').length,
    reviewsOutstanding: REVIEWS.filter(
      (r) => r.self !== 'Submitted' || r.manager !== 'Submitted').length,
  };
}

WW.hr = {
  PEOPLE, LEAVE, LEAVE_TYPES, REVIEW_CYCLE, REVIEWS, GOALS,
  ONBOARDING, POLICIES, MY_DOCUMENTS,
  byId, fmtDate, fmtRange, hrSummary,
};

})(window.WW);
