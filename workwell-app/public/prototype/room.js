/* ==========================================================================
   WorkWell — The room

   A top-down office that acts as the whole navigation surface. Rendered once
   here and reused twice: full size as the home screen, and compact inside the
   nav overlay on every other screen.

   The plan is not decoration. Private-plane destinations sit at *your* desk;
   the organisation dashboard is behind a badge-locked meeting-room door that
   an employee account genuinely cannot open. The floor plan is the privacy
   model.

   Accessibility: a picture cannot be the only way to navigate. Every object
   is a focusable button with a real label, labels are always visible rather
   than hover-only, and the room ships beside a plain list view.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

/** First run sends you through setup instead of straight to the check-in. */
function hasOnboarded() {
  try { return localStorage.getItem('ww.onboarded') === '1'; } catch (e) { return false; }
}

/* ------------------------------------------------------------ Time of day

   The room observes the boundary the product is selling: after quiet hours
   begin the lights are off and it stops inviting you in. Nothing is ever
   blocked — every destination still works. It just stops asking.
   --------------------------------------------------------------------- */

const QUIET_DEFAULT = { from: 18 * 60 + 30, to: 8 * 60 + 30 };   // 6:30 pm → 8:30 am

function quietHours() {
  const read = (k, fallback) => {
    try {
      const v = localStorage.getItem(k);
      return v === null ? fallback : Number(v);
    } catch (e) { return fallback; }
  };
  return {
    from: read('ww.quietFrom', QUIET_DEFAULT.from),
    to:   read('ww.quietTo',   QUIET_DEFAULT.to),
  };
}

/** Minutes since midnight. `?time=21:40` overrides, so the night state is demoable. */
function nowMinutes() {
  const q = new URLSearchParams(location.search).get('time');
  const m = q && /^\d{1,2}:\d{2}$/.test(q) ? q.split(':') : null;
  if (m) return (Number(m[0]) % 24) * 60 + (Number(m[1]) % 60);
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** 'morning' | 'day' | 'quiet' */
function phaseAt(mins, quiet) {
  const q = quiet || quietHours();
  const inQuiet = q.from > q.to
    ? (mins >= q.from || mins < q.to)     // window crosses midnight
    : (mins >= q.from && mins < q.to);
  if (inQuiet) return 'quiet';
  return mins < 12 * 60 ? 'morning' : 'day';
}

function formatTime(mins) {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`;
}

/* Destinations, in tab order. `plane` decides who may enter. */
const SPOTS = [
  { id: 'desk',    href: 'trends.html',    plane: 'private',
    label: 'Your desk',      sub: 'Trends' },
  { id: 'journal', href: 'check-in.html',  plane: 'private',
    label: 'Journal',        sub: 'Check in',
    altHref: 'onboarding.html', altSub: 'Set up', altWhen: () => !hasOnboarded() },
  { id: 'cooler',  href: 'nudges.html',    plane: 'private',
    label: 'Water cooler',   sub: 'Nudges' },
  { id: 'clock',   href: 'boundary.html',  plane: 'private',
    label: 'The clock',      sub: 'Boundaries' },
  { id: 'lounge',  href: 'recognition.html', plane: 'private',
    label: 'The sofa',       sub: 'Recognition' },
  { id: 'shelf',   href: 'workspace.html', plane: 'private',
    label: 'Your shelf',     sub: 'Workspace' },
  { id: 'meeting', href: 'org-diagnostics.html', plane: 'org',
    label: 'Meeting room',   sub: 'Structural load' },
  { id: 'locker',  href: 'my-leave.html',   plane: 'private',
    label: 'Your locker',    sub: 'Leave & profile' },
  { id: 'files',   href: 'hr-people.html',  plane: 'org',
    label: 'HR office',      sub: 'People & records' },

  /* The rest of a full HR system's worth of destinations — previously only
     reachable from the plain directory list beside the room, never drawn as
     furniture in the picture itself. `plane: 'org'` here means what it
     means everywhere else in this list: locked to anyone without the org
     capability, shown locked rather than hidden, same as the meeting room. */
  { id: 'tasks',      href: 'tasks.html',      plane: 'private',
    label: 'Task board',      sub: 'Yours & assigned' },
  { id: 'holidays',   href: 'holidays.html',   plane: 'private',
    label: 'Holidays',        sub: 'Calendar' },
  { id: 'attendance', href: 'attendance.html', plane: 'private',
    label: 'Attendance',      sub: 'Check-ins' },
  { id: 'payroll',    href: 'payroll.html',    plane: 'private',
    label: 'Payroll',         sub: 'Payslips' },
  { id: 'expenses',   href: 'expenses.html',   plane: 'private',
    label: 'Expenses',        sub: 'Claims' },
  { id: 'assets',     href: 'assets.html',     plane: 'private',
    label: 'Assets',          sub: 'On loan' },
  { id: 'news',       href: 'news.html',       plane: 'private',
    label: 'News',            sub: 'Notices' },
  { id: 'complaints', href: 'complaints.html', plane: 'private',
    label: 'Complaints',      sub: 'File a case' },
  { id: 'policies',   href: 'company-policies.html', plane: 'private',
    label: 'Policies',        sub: 'Read once' },
  { id: 'resignations', href: 'resignations.html', plane: 'private',
    label: 'Resignations',    sub: 'Give notice' },
  { id: 'letterheads', href: 'letter-heads.html', plane: 'org',
    label: 'Letter heads',    sub: 'Templates' },
  { id: 'customfields', href: 'custom-fields.html', plane: 'org',
    label: 'Data fields',     sub: 'Extra fields' },
  { id: 'offboarding', href: 'offboarding.html', plane: 'org',
    label: 'Offboarding',     sub: 'Checklist' },
  { id: 'warnings',   href: 'warnings.html',   plane: 'org',
    label: 'Warnings',        sub: 'Records' },
];

/* ------------------------------------------------------------------- Art */

const tag = (x, y, label, sub) => `
  <g class="spot__tag" transform="translate(${x} ${y})">
    <rect class="spot__tagbg" x="-58" y="-15" width="116" height="30" rx="15"/>
    <text class="spot__tagtext" x="0" y="-2">${label}</text>
    <text class="spot__tagsub"  x="0" y="10">${sub}</text>
  </g>`;

function spotOpen(s, inner, tx, ty) {
  return `
  <g class="spot" data-go="${s.href}" data-spot="${s.id}"
     tabindex="0" role="button" aria-label="${s.label} — ${s.sub}">
    <g class="spot__art">${inner}</g>
    ${tag(tx, ty, s.label, s.sub)}
  </g>`;
}


/* --------------------------------------------------------------- Builder */

/**
 * @param {object} opts
 *   role   'employee' | 'hr'  — decides whether the meeting room opens
 *   compact  smaller labels for the nav overlay
 */
function roomSVG(opts) {
  const o = opts || {};

  /* Two independent capabilities in the generator, not one exclusive role —
     `role` is the prototype's shorthand, from a sign-in that picked one demo
     persona or the other, so nobody was ever both. This app's own account
     model has since narrowed to one plane per account: HR/admin is its own
     kind of account with no employment record of its own, and never reaches
     this component at all (it lands on the administration dashboard
     instead — see office.tsx and page.tsx). So in practice `own` is always
     true and `org` is always false here; the two stay independent inputs
     because the generator is still the one vendored from the prototype and
     other callers may not share this app's narrower model. */
  const own = o.own !== undefined ? o.own : o.role !== 'hr';
  const org = o.org !== undefined ? o.org : o.role === 'hr';

  /* --- room lighting ---
     One even wash across the whole floor rather than a scatter of bulb-like
     points — this reads as the room's own overhead lighting, not a lamp
     sitting somewhere in it. Drawn at every hour but only bright at night,
     so the room reads as a room with its lights off rather than one that
     has been greyed out. A gradient, not a blurred shape: the fill covers
     the entire floor, and blurring an area that size is real paint cost
     for every frame it (or anything near it) repaints — a gradient costs
     nothing extra to hold at that scale. Purely scenery: no tabindex, no
     data-go, nothing to land on with a keyboard. */
  const lights = `
    <rect class="room-glow" x="24" y="24" width="952" height="672" rx="22"
          fill="url(#room-glow-grad)" aria-hidden="true"/>`;

  /* ------------------------------------------------------------- Layout

     The floor is divided into three walled areas and three open zones, and
     every object below is placed on one grid so no two pieces of furniture
     and — just as important — no two name tags ever overlap. A tag pill is
     116 wide and 30 tall, which is what sets the minimum spacing: columns
     need ~120px of pitch, rows ~95px.

       HR office     x 360-660, y  24-350   (org only — walled, own:false
                                             draws nothing here at all)
       Meeting room  x 660-976, y  24-270   (org only — same as above)
       Left strip    x  24-360, y  24-696   (open — the personal desk area)
       Mid floor     x 360-660, y 350-696   (open — rug, cooler, front door)
       Right floor   x 660-976, y 270-696   (open — the sofa)

     A private account (own:true, org:false) never draws the two walled
     rooms, which leaves their footprint — roughly x 360-920, y 24-260 —
     as open floor too. That is where hrKit puts the self-service items
     that don't fit the three zones above: two rows of three, well clear
     of the sofa below and the desk cluster to the left.
     --------------------------------------------------------------------- */

  /* --- desk (trends), left strip --- */
  const desk = `
    <rect class="furn" x="70" y="312" width="240" height="112" rx="12"/>
    <rect class="furn-2" x="124" y="300" width="132" height="18" rx="6"/>
    <rect class="screen" x="132" y="304" width="116" height="10" rx="4"/>
    <circle class="furn-2" cx="190" cy="464" r="28"/>
    <rect class="furn-2" x="166" y="482" width="48" height="12" rx="6"/>`;

  /* --- journal on the desk (check-in) --- */
  const journal = `
    <rect class="furn-3" x="244" y="336" width="52" height="66" rx="7"/>
    <line class="ink" x1="256" y1="354" x2="284" y2="354"/>
    <line class="ink" x1="256" y1="368" x2="284" y2="368"/>
    <line class="ink" x1="256" y1="382" x2="274" y2="382"/>`;

  /* --- water cooler + plant (nudges), mid floor --- */
  const cooler = `
    <rect class="furn" x="400" y="390" width="54" height="76" rx="10"/>
    <rect class="accent-soft" x="410" y="400" width="34" height="30" rx="6"/>
    <circle class="plant" cx="495" cy="424" r="26"/>
    <circle class="plant-2" cx="481" cy="412" r="13"/>
    <circle class="plant-2" cx="509" cy="414" r="11"/>`;

  /* --- wall clock (boundaries) — hands show the actual time --- */
  const mins = o.minutes == null ? nowMinutes() : o.minutes;
  const hand = (lenPx, deg) => {
    const a = (deg - 90) * Math.PI / 180;
    return { x: 245 + lenPx * Math.cos(a), y: 78 + lenPx * Math.sin(a) };
  };
  const hEnd = hand(11, ((mins / 60) % 12) * 30);
  const mEnd = hand(17, (mins % 60) * 6);
  const clock = `
    <circle class="furn" cx="245" cy="78" r="30"/>
    <circle class="furn-3" cx="245" cy="78" r="22"/>
    <line class="ink-2" x1="245" y1="78" x2="${hEnd.x.toFixed(1)}" y2="${hEnd.y.toFixed(1)}"/>
    <line class="ink-2" x1="245" y1="78" x2="${mEnd.x.toFixed(1)}" y2="${mEnd.y.toFixed(1)}"
          stroke-width="2.5"/>
    <circle class="ink-dot" cx="245" cy="78" r="2.5"/>`;

  /* --- lounge (recognition), right floor --- */
  const lounge = `
    <rect class="furn" x="665" y="300" width="130" height="55" rx="18"/>
    <rect class="furn-2" x="677" y="288" width="106" height="18" rx="9"/>
    <circle class="accent-soft" cx="700" cy="328" r="9"/>
    <circle class="accent-soft" cx="760" cy="328" r="9"/>`;

  /* --- personal shelf (workspace), left strip --- */
  const shelf = `
    <rect class="furn" x="77" y="40" width="46" height="75" rx="10"/>
    <line class="ink" x1="83" y1="70" x2="117" y2="70"/>
    <line class="ink" x1="83" y1="94" x2="117" y2="94"/>
    <circle class="accent-soft" cx="100" cy="55" r="7"/>`;

  /* --- locker: the employee's own employment self-service --- */
  const locker = `
    <rect class="furn" x="77" y="570" width="46" height="60" rx="8"/>
    <line class="ink" x1="85" y1="592" x2="115" y2="592"/>
    <circle class="accent-soft" cx="114" cy="606" r="5"/>`;

  /* --- filing cabinet: the HR system of record. Now literally inside the
         HR office, rather than standing in the open floor beside it. --- */
  const files = `
    <rect class="furn" x="408" y="58" width="48" height="58" rx="8"/>
    <line class="ink" x1="418" y1="78" x2="446" y2="78"/>
    <line class="ink" x1="418" y1="96" x2="446" y2="96"/>
    <circle class="accent-soft" cx="432" cy="66" r="4"/>`;

  /* --- task board, right floor —— x660-976/y270-696 had nothing below the
     sofa at y355, so the bottom third of the room read as bare floor. It
     used to hold a reading nook that was pure scenery; this is the same
     footprint doing a job.

     Unlike every other spot, this one carries live content: the rows below
     are drawn empty and office.tsx fills in the titles and ticks after the
     room is built (see paintTaskBoard there). That keeps this file free of
     any data access — it still renders standalone in the prototype, just
     with an empty board — and it is why the row parts carry stable classes
     rather than being anonymous shapes.

     Two headings, because the two kinds of task are not interchangeable:
     what somebody asked of you, and what you set yourself. The second
     never leaves your own plane, and a board that ran them together would
     be the one place in this room that implied otherwise.

     The ticks here are drawn, not pressed. The room is a way of getting to
     things; the dock's time-in button is the single exception, and it
     exists only because clocking in has nowhere else to live. Ticking a
     task has a whole screen of its own two clicks away. --- */
  const taskboard = `
    <rect class="rug" x="668" y="428" width="278" height="196" rx="16"/>
    <rect class="furn" x="684" y="440" width="246" height="172" rx="12"/>
    <g class="taskboard" aria-hidden="true">
      <text class="taskboard__head" x="700" y="466">Assigned</text>
      <g class="taskboard__row" data-row="0">
        <rect class="taskboard__box" x="700" y="476" width="13" height="13" rx="3"/>
        <path class="taskboard__tick" d="M 703 483 l 3 3.5 l 6.5 -7.5"/>
        <text class="taskboard__text" x="722" y="487"></text>
      </g>
      <g class="taskboard__row" data-row="1">
        <rect class="taskboard__box" x="700" y="500" width="13" height="13" rx="3"/>
        <path class="taskboard__tick" d="M 703 507 l 3 3.5 l 6.5 -7.5"/>
        <text class="taskboard__text" x="722" y="511"></text>
      </g>
      <text class="taskboard__head" x="700" y="546">Yours</text>
      <g class="taskboard__row" data-row="2">
        <rect class="taskboard__box" x="700" y="556" width="13" height="13" rx="3"/>
        <path class="taskboard__tick" d="M 703 563 l 3 3.5 l 6.5 -7.5"/>
        <text class="taskboard__text" x="722" y="567"></text>
      </g>
      <g class="taskboard__row" data-row="3">
        <rect class="taskboard__box" x="700" y="580" width="13" height="13" rx="3"/>
        <path class="taskboard__tick" d="M 703 587 l 3 3.5 l 6.5 -7.5"/>
        <text class="taskboard__text" x="722" y="591"></text>
      </g>
      <text class="taskboard__more" x="700" y="604"></text>
    </g>`;

  /* --- meeting room contents (org) --- */
  const meeting = `
    <ellipse class="furn" cx="812" cy="140" rx="100" ry="52"/>
    <circle class="furn-2" cx="712" cy="140" r="18"/>
    <circle class="furn-2" cx="912" cy="140" r="18"/>
    <circle class="furn-2" cx="770" cy="66"  r="18"/>
    <circle class="furn-2" cx="854" cy="66"  r="18"/>
    <circle class="furn-2" cx="770" cy="214" r="18"/>
    <circle class="furn-2" cx="854" cy="214" r="18"/>`;

  /* Resolve a spot's current destination — the journal points at setup until
     it has been completed once, so onboarding is reachable from the room.
     Defined here, ahead of the HR kit below, because that kit's spots need
     it immediately rather than after the furniture is all built. */
  const by = (id) => {
    const s = SPOTS.find((x) => x.id === id);
    return (s.altWhen && s.altWhen())
      ? Object.assign({}, s, { href: s.altHref, sub: s.altSub })
      : s;
  };

  /* --- the rest of the HR system, drawn as furniture ---
     Small pieces, all built from the same three furn tones + ink already
     used everywhere else in the room, at (x, y) centres so the whole set
     reads as one consistent kit rather than one-off art per object. */
  const kit = {
    calendar: (x, y) => `
      <rect class="furn" x="${x - 18}" y="${y - 20}" width="36" height="40" rx="6"/>
      <rect class="accent-soft" x="${x - 11}" y="${y - 16}" width="22" height="7" rx="3"/>
      <line class="ink" x1="${x - 11}" y1="${y - 2}" x2="${x + 11}" y2="${y - 2}"/>
      <line class="ink" x1="${x - 11}" y1="${y + 9}" x2="${x + 11}" y2="${y + 9}"/>`,
    check: (x, y) => `
      <circle class="furn" cx="${x}" cy="${y}" r="20"/>
      <circle class="furn-3" cx="${x}" cy="${y}" r="14"/>
      <path class="ink-2" d="M${x - 7} ${y} L${x - 2} ${y + 6} L${x + 8} ${y - 7}" fill="none"/>`,
    tray: (x, y) => `
      <rect class="furn" x="${x - 22}" y="${y - 13}" width="44" height="28" rx="6"/>
      <circle class="accent-soft" cx="${x}" cy="${y + 1}" r="9"/>`,
    receipt: (x, y) => `
      <rect class="furn-3" x="${x - 16}" y="${y - 21}" width="32" height="42" rx="5"/>
      <line class="ink" x1="${x - 9}" y1="${y - 9}" x2="${x + 9}" y2="${y - 9}"/>
      <line class="ink" x1="${x - 9}" y1="${y + 1}" x2="${x + 9}" y2="${y + 1}"/>
      <line class="ink" x1="${x - 9}" y1="${y + 11}" x2="${x + 3}" y2="${y + 11}"/>`,
    crate: (x, y) => `
      <rect class="furn" x="${x - 24}" y="${y - 18}" width="48" height="38" rx="6"/>
      <line class="ink" x1="${x - 24}" y1="${y}" x2="${x + 24}" y2="${y}"/>
      <line class="ink" x1="${x}" y1="${y - 18}" x2="${x}" y2="${y + 20}"/>`,
    board: (x, y) => `
      <rect class="furn" x="${x - 26}" y="${y - 16}" width="52" height="34" rx="6"/>
      <rect class="furn-3" x="${x - 18}" y="${y - 9}" width="15" height="12" rx="2"/>
      <rect class="furn-3" x="${x + 3}" y="${y - 9}" width="15" height="12" rx="2"/>`,
    dropbox: (x, y) => `
      <rect class="furn" x="${x - 18}" y="${y - 20}" width="36" height="42" rx="8"/>
      <rect class="ink" x="${x - 10}" y="${y - 10}" width="20" height="4" rx="2"/>`,
    binder: (x, y) => `
      <rect class="furn" x="${x - 16}" y="${y - 22}" width="32" height="44" rx="4"/>
      <line class="ink-2" x1="${x - 16}" y1="${y - 14}" x2="${x - 16}" y2="${y + 14}" stroke-width="4"/>`,
    stack: (x, y) => `
      <rect class="furn" x="${x - 20}" y="${y - 15}" width="40" height="8" rx="3"/>
      <rect class="furn-2" x="${x - 20}" y="${y - 4}" width="40" height="8" rx="3"/>
      <rect class="furn-3" x="${x - 20}" y="${y + 7}" width="40" height="8" rx="3"/>`,
    grid: (x, y) => `
      <rect class="furn" x="${x - 20}" y="${y - 18}" width="40" height="36" rx="6"/>
      <circle class="accent-soft" cx="${x - 8}" cy="${y - 5}" r="4"/>
      <circle class="accent-soft" cx="${x + 8}" cy="${y - 5}" r="4"/>
      <circle class="accent-soft" cx="${x - 8}" cy="${y + 7}" r="4"/>
      <circle class="accent-soft" cx="${x + 8}" cy="${y + 7}" r="4"/>`,
    caution: (x, y) => `
      <path class="furn-2" d="M${x} ${y - 20} L${x + 20} ${y + 16} L${x - 20} ${y + 16} Z"/>
      <line class="ink-2" x1="${x}" y1="${y - 5}" x2="${x}" y2="${y + 5}"/>
      <circle class="ink-dot" cx="${x}" cy="${y + 11}" r="2"/>`,
    outtray: (x, y) => `
      <rect class="furn" x="${x - 20}" y="${y - 5}" width="40" height="20" rx="4"/>
      <line class="ink-2" x1="${x}" y1="${y - 22}" x2="${x}" y2="${y - 8}"/>
      <path class="ink-2" d="M${x - 7} ${y - 15} L${x} ${y - 22} L${x + 7} ${y - 15}" fill="none"/>`,
    exit: (x, y) => `
      <rect class="furn" x="${x - 16}" y="${y - 22}" width="28" height="44" rx="3"/>
      <line class="ink-2" x1="${x + 16}" y1="${y}" x2="${x + 30}" y2="${y}"/>
      <path class="ink-2" d="M${x + 23} ${y - 6} L${x + 30} ${y} L${x + 23} ${y + 6}" fill="none"/>`,
  };

  /* A shared counter/shelf under each related cluster — the same "furniture
     an object sits on" language the desk already carries the journal with,
     just wide enough to hold two or three objects instead of one. Purely
     decorative: it never takes a tabindex or a data-go of its own. */
  const surface = (x, y, w, h) => `
      <rect class="furn-3" x="${x}" y="${y}" width="${w}" height="${h}" rx="14" aria-hidden="true"/>`;

  /* The self-service everyone can use. Two pairs stay up the left strip
     (time, then personal records at the bottom, where they've always
     been). The other six now live in the space the HR office and meeting
     room used to wall off — empty floor for a private account, since it
     never had anything of its own to put there — laid out as two rows of
     three across the middle of that space rather than left crammed into
     the right floor the two rooms used to leave it. Same 116x30 tag pill,
     same discipline: columns 200px apart, rows 105px apart, comfortably
     clear of the sofa at y280 below and the strip's own desk cluster at
     x360 to the left. */
  const hrKit = own ? `
    ${surface(55, 165, 235, 62)}
    ${spotOpen(by('holidays'),   kit.calendar(100, 195), 100, 247)}
    ${spotOpen(by('attendance'), kit.check(245, 195),    245, 247)}

    ${surface(50, 560, 250, 70)}
    ${spotOpen(by('locker'),     locker,                 100, 652)}
    ${spotOpen(by('policies'),   kit.binder(245, 600),   245, 652)}

    ${surface(390, 65, 520, 55)}
    ${spotOpen(by('expenses'),   kit.receipt(460, 90),   460, 142)}
    ${spotOpen(by('assets'),     kit.crate(660, 90),     660, 142)}
    ${spotOpen(by('payroll'),    kit.tray(860, 90),      860, 142)}

    ${surface(390, 175, 520, 55)}
    ${spotOpen(by('news'),         kit.board(460, 195),    460, 247)}
    ${spotOpen(by('complaints'),   kit.dropbox(660, 195),  660, 247)}
    ${spotOpen(by('resignations'), kit.outtray(860, 195),  860, 247)}` : '';

  /* The HR office and the meeting room's contents — both org-gated, both
     drawn after employeeFloor in the final markup, so both live in this
     one `org ? ... : ''` rather than deciding twice. (The walls and
     badge readers those two rooms share can't join them here: they have
     to paint before employeeFloor so furniture layers on top of the
     architecture, not the other way round — that's the one org-gated
     fragment that still has to stay separate, below.)

     An HR/admin account is the only account that ever sees any of this,
     so for anyone else it simply is not drawn — no furniture, no tag,
     nothing to notice. The account model is one plane per account, not a
     role added on top of one everybody shares, so there is no closed
     door here worth narrating; the walls stay, as the room's
     architecture, but what used to render locked-with-a-reason for a
     private account now renders nothing at all. Two columns of two along
     the HR office's back wall, then its exit on its own centred row, all
     clear of each other and of the walls; the meeting table sits alone
     in the room next door. */
  const hrLocked = org ? `
    ${surface(385, 45, 250, 72)}
    ${surface(385, 150, 250, 62)}
    ${spotOpen(by('files'), files, 432, 137)}
    ${spotOpen(by('letterheads'), kit.stack(578, 85), 578, 137)}
    ${spotOpen(by('customfields'), kit.grid(432, 180), 432, 232)}
    ${spotOpen(by('warnings'), kit.caution(578, 180), 578, 232)}
    ${spotOpen(by('offboarding'), kit.exit(505, 275), 505, 327)}
    ${spotOpen(by('meeting'), meeting, 812, 252)}` : '';

  /* An organisation account gets the meeting room and nothing else. The
     employee floor is not drawn as furniture they cannot use — it is drawn
     as a sealed area, because an HR leader has no business seeing whose desk
     is whose. The wall is the point. */
  const employeeFloor = !own ? `
    <g class="sealed" aria-hidden="true">
      <rect class="sealed__fill" x="44" y="44" width="308" height="632" rx="16"/>
      <rect class="sealed__fill" x="368" y="360" width="588" height="316" rx="16"/>
      <g transform="translate(660 500)">
        <rect class="sealed__badge" x="-118" y="-40" width="236" height="80" rx="18"/>
        <g transform="translate(0 -12)">
          <path class="sealed__icon" transform="translate(-11 -11) scale(0.92)"
                d="M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z
                   M7 11V7a5 5 0 0 1 10 0v4"/>
        </g>
        <text class="sealed__title" x="0" y="16">Private plane</text>
        <text class="sealed__sub" x="0" y="32">Employees only — sealed from your account</text>
      </g>
    </g>` : `
    ${spotOpen(by('shelf'), shelf, 100, 132)}
    <!-- The clock's tag used to read out the live time, which made the one
         spot on the wall that is about *setting* your hours look like a
         readout of them. Its own one-word sub ("Boundaries") says what
         going there does; the drawn hands still tell the time. -->
    ${spotOpen(by('clock'), clock, 245, 132)}
    <!-- Desk before journal: the journal sits ON the desk, and .furn carries
         a translucent fill, so drawing the desk second tinted the notebook —
         and would wash out its label now that the label sits on it too.
         Painting the desk first puts the thing on the surface above the
         surface, which is the order a hand would put them down in. -->
    ${spotOpen(by('desk'), desk, 190, 534)}
    ${spotOpen(by('journal'), journal, 270, 369)}
    ${spotOpen(by('cooler'), cooler, 450, 510)}
    ${spotOpen(by('lounge'), lounge, 730, 382)}
    ${spotOpen(by('tasks'), taskboard, 807, 646)}
    ${hrKit}`;

  return `
  <svg class="room__svg" viewBox="0 0 1000 720" role="img"
       aria-label="Top-down plan of your space. Use the destination buttons, or switch to the list view.">

    <defs>
      <radialGradient id="room-glow-grad" cx="50%" cy="50%" r="65%">
        <stop offset="0%" stop-color="rgba(255,214,138,.9)"/>
        <stop offset="100%" stop-color="rgba(255,214,138,0)"/>
      </radialGradient>
    </defs>

    <!-- floor & outer wall -->
    <rect class="floor" x="24" y="24" width="952" height="672" rx="22"/>
    <rect class="wall"  x="24" y="24" width="952" height="672" rx="22"/>

    <!-- A soft halo hugging the wall's own outline — the room's light
         reaching its edges, not a line drawn around the picture. Blurring
         a stroke is cheap regardless of the shape's size: only the thin
         painted band costs anything, unlike a blurred fill over the whole
         floor. -->
    <rect class="room-glow-ring" x="24" y="24" width="952" height="672" rx="22" aria-hidden="true"/>

    <!-- Centred on the open mid floor between the two rooms above and the
         front door below, not on the whole plan — the plan is no longer one
         open space, so the middle of the drawing is inside a wall. -->
    ${own ? '<rect class="rug" x="395" y="448" width="230" height="150" rx="16"/>' : ''}

    <!-- lit pools go over the floor and under the furniture, so the light
         falls on the room rather than washing across the top of it -->
    ${lights}

    <!-- Two walled rooms across the top, sharing the partition at x=660:
         the HR office on the left, the meeting room on the right. Only
         drawn for an account that can actually open them — an empty
         walled room is not scenery, it just reads as unfinished, and no
         other account will ever have anything to put in it. Each has its
         own doorway gap — the HR office opens downward onto the mid
         floor, the meeting room opens downward onto the right floor — so
         they read as two rooms rather than one long one. -->
    ${org ? `
    <path class="wall-inner"
          d="M360 24 L360 350
             M660 24 L660 350
             M360 350 L480 350 M540 350 L660 350
             M660 270 L790 270 M850 270 L976 270"/>

    <rect class="reader is-open" x="548" y="356" width="24" height="14" rx="4"/>
    <rect class="reader is-open" x="856" y="278" width="24" height="14" rx="4"/>` : ''}

    ${employeeFloor}

    ${hrLocked}

    <!-- front doors: two leaves that swing inward on sign-in -->
    <g class="doors">
      <rect class="doorleaf doorleaf--l" x="430" y="686" width="70" height="16" rx="6"/>
      <rect class="doorleaf doorleaf--r" x="500" y="686" width="70" height="16" rx="6"/>
    </g>

    <!-- The way in is the form beside the room, not this door — but once
         you're in it, this is the way out. data-signout marks it apart
         from data-go: the host still owns what "sign out" actually does,
         this is only the trigger. -->
    <g class="spot frontdoor" data-signout="true" tabindex="0" role="button" aria-label="Front door — sign out">
      <rect class="frontdoor__hit" x="416" y="656" width="168" height="60" rx="14"/>
      <circle class="frontdoor__pulse" cx="500" cy="686" r="46"/>
      ${tag(500, 640, 'Front door', 'Sign out')}
    </g>

    <!-- you, once you are inside.
         Named room-avatar, not avatar: the global .avatar component is the
         initials circle used across the app, and the two collided. -->
    <g class="room-avatar" aria-hidden="true">
      <circle class="room-avatar__dot" cx="500" cy="672" r="16"/>
      <text class="room-avatar__initials" x="500" y="678">?</text>
    </g>
  </svg>`;
}

/* --------------------------------------------------------------- Wiring */

/** Makes the objects in a rendered room navigable. Locked spots and the
 *  front door no longer have a distinct handling path here — neither
 *  roomSVG() output carries a locked spot or a data-frontdoor target any
 *  more (see spotOpen and the frontdoor group above), so this only ever
 *  has plain, open spots to wire up. */
function wireRoom(container, opts) {
  const o = opts || {};

  const go = (el) => {
    const href = el.dataset.go;
    if (href) location.href = href;
  };

  container.addEventListener('click', (e) => {
    const spot = e.target.closest('.spot');
    if (spot && !o.locked?.()) go(spot);
  });

  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const spot = e.target.closest?.('.spot');
    if (!spot) return;
    e.preventDefault();
    if (!o.locked?.()) go(spot);
  });
}

/**
 * The plain-text equivalent of the room. Never optional.
 * `locked` mirrors the room's own gate — before sign-in these must not be
 * live links, or the list becomes a way around the front door.
 */
function roomList(role, locked, opts) {
  const o = opts || {};
  const own = o.own !== undefined ? o.own : role !== 'hr';
  const org = o.org !== undefined ? o.org : role === 'hr';

  // A destination on the plane you hold is listed, open before sign-in or
  // locked ("Sign in first") until then — the account model is one plane
  // per account now, not a role stacked on top of one everybody shares, so
  // a destination on the *other* plane is never yours to open no matter
  // what happens here. Listing it locked would only leak its name and
  // shape to an account that can never reach it; the SVG room already
  // hides those spots outright for the same reason, and this mirrors it.
  const visible = SPOTS.filter((s) => (s.plane === 'org' ? org : own));

  const items = visible.map((base) => {
    const s = (base.altWhen && base.altWhen())
      ? Object.assign({}, base, { href: base.altHref, sub: base.altSub })
      : base;
    const open = !locked;
    if (open) {
      return `<li><a class="roomlist__item" href="${s.href}">
           <span class="roomlist__label">${s.label}</span>
           <span class="roomlist__sub">${s.sub}</span></a></li>`;
    }
    return `<li><span class="roomlist__item is-locked" aria-disabled="true">
           <span class="roomlist__label">${s.label}</span>
           <span class="roomlist__sub">Sign in first</span></span></li>`;
  }).join('');

  return `<ul class="roomlist">${items}</ul>`;
}

WW.room = {
  SPOTS, roomSVG, wireRoom, roomList,
  nowMinutes, phaseAt, quietHours, formatTime,
};

})(window.WW);
