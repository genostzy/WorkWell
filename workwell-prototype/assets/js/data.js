/* ==========================================================================
   WorkWell — Mock data
   Deterministic fixtures so every screenshot is identical.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

const WEEKS = ['Mar 3', 'Mar 10', 'Mar 17', 'Mar 24', 'Mar 31', 'Apr 7',
               'Apr 14', 'Apr 21', 'Apr 28', 'May 5', 'May 12', 'May 19'];

/* ---------------------------------------------------------------------------
   PRIVATE PLANE — one employee's own signals.
   Baselines are the person's own median, never a cohort norm and never a score.
   --------------------------------------------------------------------------- */

const PERSONAL = {
  weeks: WEEKS,

  workingHours: {
    label: 'Working hours',
    unit: 'h/week',
    values: [39, 41, 38, 40, 42, 41, 44, 43, 46, 47, 45, 49],
    baseline: 41,
    band: [37, 44],           // the person's own typical range
  },

  afterHours: {
    label: 'After-hours activity',
    unit: 'messages sent after 18:30',
    values: [4, 6, 3, 5, 8, 7, 9, 11, 14, 13, 17, 19],
    baseline: 6,
    band: [2, 9],
  },

  meetingLoad: {
    label: 'Meeting load',
    unit: 'h/week',
    values: [8, 11, 9, 10, 13, 12, 14, 13, 16, 15, 18, 17],
    baseline: 11,
    band: [7, 14],
  },

  consecutiveDays: {
    label: 'Longest run without a full day off',
    unit: 'days',
    values: [5, 5, 6, 5, 7, 6, 8, 7, 9, 11, 10, 12],
    baseline: 5,
    band: [4, 7],
  },

  timeOff: {
    label: 'Time off taken',
    unit: 'days this quarter',
    taken: 2,
    available: 14,
  },

  /* Self-reported, 1–5, weekly average of the daily check-ins. */
  mood:     { label: 'Mood',              values: [4, 4, 4, 3, 4, 3, 3, 3, 3, 2, 3, 2] },
  energy:   { label: 'Energy',            values: [4, 4, 3, 4, 3, 3, 3, 2, 3, 2, 2, 2] },
  stress:   { label: 'Stress',            values: [2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 4, 5] },
  workload: { label: 'Workload feels',    values: [3, 3, 3, 3, 4, 3, 4, 4, 4, 5, 4, 5] },
};

/* Plain-language annotations: what changed, over what window, and one thing
   you could do. Never a score, never a prediction, never a verdict.
   (PRD 5.1 / 6 Step 4 — changed factors plus a suggested action.) */
const INSIGHTS = [
  {
    icon: 'moon',
    title: 'After-hours messages up 3 weeks running',
    text: '19 last week, against your usual 6.',
    action: 'Try quiet hours',
    href: 'boundary.html',
    meta: 'Your own last 12 weeks',
  },
  {
    icon: 'calendar',
    title: 'More meetings, shorter focus blocks',
    text: '17 meeting hours against your usual 11. Longest clear block fell from 3 hours to 45 minutes.',
    action: 'Protect a block',
    href: 'workspace.html',
    meta: 'Two factors moved together',
  },
  {
    icon: 'clock',
    title: 'No full day off in 12 days',
    text: 'You usually break every 5–7. You have 12 days available.',
    action: 'Book time off',
    href: '#',
    meta: 'Longest run in 12 weeks',
  },
];

/* Sparse-data variant — what the same screen shows in week 1. */
const THIN_INSIGHT = {
  text: '3 check-ins so far. Trends need about two weeks — we would rather show nothing than guess.',
};

const NUDGES = [
  { icon: 'stretch', title: 'Stretch', text: "Won't fix a heavy week. Helps the next hour.", enabled: true },
  { icon: 'drop',    title: 'Water',   text: 'Mid-afternoon. Off on days you mark busy.', enabled: true },
  { icon: 'eye',     title: 'Eye break', text: 'Look 6 metres away for 20 seconds.', enabled: false },
  { icon: 'walk',    title: 'Walk',    text: 'Uses a free calendar slot.', enabled: true },
];

const RECOGNITION = [
  { from: 'Priya N.', initials: 'PN', time: '2 hours ago', text: 'Thanks for picking up the migration review at short notice — that unblocked the whole release.', kind: 'appreciation' },
  { from: 'Sam O.',   initials: 'SO', time: 'Yesterday',   text: 'Sent you a virtual coffee ☕ — free Thursday morning if you fancy a catch-up.', kind: 'coffee' },
  { from: 'Dee K.',   initials: 'DK', time: '3 days ago',  text: 'Your notes on the incident write-up were genuinely the clearest I have read here.', kind: 'appreciation' },
];

/* ---------------------------------------------------------------------------
   ORG PLANE — anonymous, structural, cohort-level only.
   `n` is the number of people whose data contributes in the selected window.
   Anything under MIN_GROUP is suppressed outright, never estimated.
   --------------------------------------------------------------------------- */

const MIN_GROUP = 8;

/* Base cohorts. `contribution` scales headcount by date range: a shorter
   window means fewer people actually generated data in it, which is exactly
   how a group can fall under the threshold after filtering. */
const COHORTS = [
  { id: 'eng-platform', dept: 'Engineering', name: 'Platform',        n: 14, hours: 44, meetings: 13, afterHours: 22, ptoUptake: 41, spread: 'wide' },
  { id: 'eng-web',      dept: 'Engineering', name: 'Web',             n: 12, hours: 41, meetings: 11, afterHours: 14, ptoUptake: 58, spread: 'even' },
  { id: 'eng-mobile',   dept: 'Engineering', name: 'Mobile',          n:  9, hours: 39, meetings:  9, afterHours:  8, ptoUptake: 64, spread: 'even' },
  { id: 'eng-qa',       dept: 'Engineering', name: 'Quality',         n:  7, hours: 38, meetings:  8, afterHours:  6, ptoUptake: 55, spread: 'even' },
  { id: 'sup-t1',       dept: 'Support',     name: 'Support Tier 1',  n: 13, hours: 43, meetings:  6, afterHours: 19, ptoUptake: 33, spread: 'wide' },
  { id: 'sup-t2',       dept: 'Support',     name: 'Support Tier 2',  n: 10, hours: 42, meetings:  7, afterHours: 17, ptoUptake: 38, spread: 'wide' },
  { id: 'sales-smb',    dept: 'Sales',       name: 'SMB',             n: 11, hours: 45, meetings: 18, afterHours: 25, ptoUptake: 29, spread: 'wide' },
  { id: 'sales-ent',    dept: 'Sales',       name: 'Enterprise',      n:  7, hours: 46, meetings: 21, afterHours: 28, ptoUptake: 24, spread: 'wide' },
  { id: 'design-prod',  dept: 'Design',      name: 'Product Design',  n:  7, hours: 40, meetings: 12, afterHours:  9, ptoUptake: 61, spread: 'even' },
  { id: 'design-res',   dept: 'Design',      name: 'Research',        n:  4, hours: 38, meetings: 10, afterHours:  5, ptoUptake: 70, spread: 'even' },
  { id: 'product',      dept: 'Product',     name: 'Product',         n:  9, hours: 42, meetings: 19, afterHours: 15, ptoUptake: 47, spread: 'even' },
  { id: 'data',         dept: 'Data',        name: 'Data & Analytics',n:  8, hours: 40, meetings: 10, afterHours: 11, ptoUptake: 52, spread: 'even' },
  { id: 'finance',      dept: 'Finance',     name: 'Finance',         n:  6, hours: 41, meetings: 11, afterHours: 12, ptoUptake: 49, spread: 'even' },
  { id: 'people',       dept: 'People Ops',  name: 'People Ops',      n:  5, hours: 39, meetings: 14, afterHours:  7, ptoUptake: 66, spread: 'even' },
];

/* How much of a cohort contributes data in each window. */
const RANGE_FACTOR = {
  '7d':  0.55,
  '30d': 0.80,
  '90d': 1.00,
};

const RANGE_LABEL = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' };

/**
 * Cohorts for the current filter, with contributing headcount recomputed and
 * the suppression flag re-evaluated. Callers must respect `locked` — the
 * metric fields are still present but must never be rendered when locked.
 */
function orgCohorts(range, dept) {
  const factor = RANGE_FACTOR[range] ?? 1;
  return COHORTS
    .filter((c) => dept === 'all' || c.dept === dept)
    .map((c) => {
      const n = Math.round(c.n * factor);
      return Object.assign({}, c, { n, locked: n < MIN_GROUP });
    });
}

/** Org-wide roll-up. Only unlocked cohorts contribute. */
function orgRollup(cohorts) {
  const open = cohorts.filter((c) => !c.locked);
  if (!open.length) return null;
  const people = open.reduce((s, c) => s + c.n, 0);
  const wavg = (k) => Math.round(open.reduce((s, c) => s + c[k] * c.n, 0) / people);
  return {
    people,
    cohorts: open.length,
    suppressed: cohorts.length - open.length,
    hours: wavg('hours'),
    meetings: wavg('meetings'),
    afterHours: wavg('afterHours'),
    ptoUptake: wavg('ptoUptake'),
  };
}

/* Distribution of weekly working hours across the whole (unlocked) population.
   Buckets, not individuals — the org plane never resolves to a person. */
const HOURS_DISTRIBUTION = {
  buckets: ['<35', '35–39', '40–44', '45–49', '50–54', '55+'],
  counts:  [9, 24, 41, 28, 14, 6],
};

/* Workload pattern: share of the cohort's weeks that ran over contracted
   hours, by week. A grid, read as "how often", not "who". */
const WORKLOAD_PATTERN = {
  rows: ['Platform', 'Support Tier 1', 'SMB Sales', 'Product', 'Web'],
  cols: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
  values: [
    [0.30, 0.35, 0.45, 0.50, 0.55, 0.62, 0.71, 0.78],
    [0.42, 0.40, 0.48, 0.52, 0.49, 0.58, 0.61, 0.66],
    [0.55, 0.58, 0.60, 0.65, 0.68, 0.72, 0.74, 0.80],
    [0.22, 0.25, 0.28, 0.30, 0.34, 0.33, 0.38, 0.41],
    [0.18, 0.20, 0.19, 0.24, 0.26, 0.25, 0.29, 0.31],
  ],
};

/* Structural prompts. These point at staffing and expectations — never at a
   person, and never suggesting anyone be identified or coached. */
const ORG_PROMPTS = [
  {
    icon: 'chart',
    title: 'Platform hours up 6 weeks running',
    text: '39 → 44 average. Two people left in March, not backfilled.',
    action: 'Review headcount against scope',
    meta: '14 people · group signal',
  },
  {
    icon: 'calendar',
    title: 'SMB Sales: 18 meeting hours per person',
    text: 'Highest of any group. Grew alongside a 22% target increase.',
    action: 'Review meeting cadence',
    meta: '11 people · group signal',
  },
  {
    icon: 'clock',
    title: 'Support has the lowest leave uptake',
    text: '33% of accrued leave used, against 52% org-wide.',
    action: 'Check holiday cover ratios',
    meta: '23 people · group signal',
  },
];

WW.data = {
  WEEKS,
  PERSONAL,
  INSIGHTS,
  THIN_INSIGHT,
  NUDGES,
  RECOGNITION,
  MIN_GROUP,
  COHORTS,
  RANGE_LABEL,
  orgCohorts,
  orgRollup,
  HOURS_DISTRIBUTION,
  WORKLOAD_PATTERN,
  ORG_PROMPTS,
};

})(window.WW);
