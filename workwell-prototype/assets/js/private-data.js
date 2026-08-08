/* ==========================================================================
   WorkWell — Private plane data

   The employee's own wellbeing signals. Loaded ONLY by private-plane pages.

   This is deliberately a separate file from data.js so that an organisation
   or HR page never even downloads it. "Your employer cannot see this" should
   not depend on nothing happening to render it — the data must not be in
   their browser at all.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

/* Refuse to populate for an organisation account.
 *
 * The page guard in app.js blanks the screen, but a <script> tag still runs —
 * so without this, opening trends.html as HR would blank the page while
 * quietly downloading the employee's mood data into that browser. The block
 * screen is a UI guard; this is the data guarantee.
 *
 * In a real deployment the API would refuse the request and this check would
 * be the second line, not the only one.
 */
try {
  const u = JSON.parse(localStorage.getItem('ww.user') || 'null');
  if (u && u.plane === 'hr') return;
} catch (e) { /* no storage — fall through and load normally */ }


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
    unit: 'messages sent after 6:30 pm',
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
  { from: 'Marco R.', initials: 'MR', time: '3 days ago',  text: 'Your notes on the incident write-up were genuinely the clearest I have read here.', kind: 'appreciation' },
];

WW.privateData = {
  WEEKS, PERSONAL, INSIGHTS, THIN_INSIGHT, NUDGES, RECOGNITION,
};

})(window.WW);
