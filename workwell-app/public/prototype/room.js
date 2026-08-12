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

function spotLocked(s, inner, tx, ty, why) {
  return `
  <g class="spot spot--locked" data-spot="${s.id}" tabindex="0" role="button"
     aria-disabled="true" aria-label="${s.label}, locked. ${why}">
    <g class="spot__art">${inner}</g>
    ${tag(tx, ty, s.label, 'Locked')}
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

  /* Two independent capabilities, not one exclusive role.
     `role` is the prototype's shorthand, from a sign-in that picked one demo
     persona or the other, so nobody was ever both. Real accounts are: an HR
     leader is also an employee and holds a private plane of their own. The
     database has always agreed — every private-plane policy reads
     person_id = current_person_id(), with no exception for the hr role.
     Passing role alone still behaves exactly as before. */
  const own = o.own !== undefined ? o.own : o.role !== 'hr';
  const org = o.org !== undefined ? o.org : o.role === 'hr';

  /* --- ceiling lights ---
     Drawn at every hour but only lit at night, so the room reads as a room
     with its lights off rather than as a room that has been greyed out.
     Purely scenery: no tabindex, no data-go, nothing to land on with a
     keyboard, because a lamp is not somewhere you can go. */
  const lights = `
    <g class="lamps" aria-hidden="true">
      <g class="lamp" transform="translate(216 250)">
        <circle class="lamp__glow" r="120"/>
        <line class="lamp__flex" x1="0" y1="-46" x2="0" y2="-12"/>
        <path class="lamp__shade" d="M-26 0 L26 0 L15 -16 L-15 -16 Z"/>
        <circle class="lamp__bulb" cy="2" r="5"/>
      </g>
      <g class="lamp" transform="translate(500 470)">
        <circle class="lamp__glow" r="132"/>
        <line class="lamp__flex" x1="0" y1="-52" x2="0" y2="-14"/>
        <path class="lamp__shade" d="M-30 0 L30 0 L17 -18 L-17 -18 Z"/>
        <circle class="lamp__bulb" cy="2" r="6"/>
      </g>
      ${org ? `
      <g class="lamp" transform="translate(812 96)">
        <circle class="lamp__glow" r="118"/>
        <line class="lamp__flex" x1="0" y1="-44" x2="0" y2="-12"/>
        <path class="lamp__shade" d="M-26 0 L26 0 L15 -16 L-15 -16 Z"/>
        <circle class="lamp__bulb" cy="2" r="5"/>
      </g>` : ''}
    </g>`;

  /* --- desk (trends) --- */
  const desk = `
    <rect class="furn" x="96" y="300" width="240" height="112" rx="12"/>
    <rect class="furn-2" x="150" y="288" width="132" height="18" rx="6"/>
    <rect class="screen" x="158" y="292" width="116" height="10" rx="4"/>
    <circle class="furn-2" cx="216" cy="452" r="28"/>
    <rect class="furn-2" x="192" y="470" width="48" height="12" rx="6"/>`;

  /* --- journal on the desk (check-in) --- */
  const journal = `
    <rect class="furn-3" x="270" y="322" width="52" height="66" rx="7"/>
    <line class="ink" x1="282" y1="340" x2="310" y2="340"/>
    <line class="ink" x1="282" y1="354" x2="310" y2="354"/>
    <line class="ink" x1="282" y1="368" x2="300" y2="368"/>`;

  /* --- water cooler + plant (nudges) --- */
  const cooler = `
    <rect class="furn" x="470" y="452" width="54" height="76" rx="10"/>
    <rect class="accent-soft" x="480" y="462" width="34" height="30" rx="6"/>
    <circle class="plant" cx="566" cy="486" r="26"/>
    <circle class="plant-2" cx="552" cy="474" r="13"/>
    <circle class="plant-2" cx="580" cy="476" r="11"/>`;

  /* --- wall clock (boundaries) — hands show the actual time --- */
  const mins = o.minutes == null ? nowMinutes() : o.minutes;
  const hand = (lenPx, deg) => {
    const a = (deg - 90) * Math.PI / 180;
    return { x: 330 + lenPx * Math.cos(a), y: 66 + lenPx * Math.sin(a) };
  };
  const hEnd = hand(11, ((mins / 60) % 12) * 30);
  const mEnd = hand(17, (mins % 60) * 6);
  const clock = `
    <circle class="furn" cx="330" cy="66" r="30"/>
    <circle class="furn-3" cx="330" cy="66" r="22"/>
    <line class="ink-2" x1="330" y1="66" x2="${hEnd.x.toFixed(1)}" y2="${hEnd.y.toFixed(1)}"/>
    <line class="ink-2" x1="330" y1="66" x2="${mEnd.x.toFixed(1)}" y2="${mEnd.y.toFixed(1)}"
          stroke-width="2.5"/>
    <circle class="ink-dot" cx="330" cy="66" r="2.5"/>`;

  /* --- lounge (recognition) --- */
  const lounge = `
    <rect class="furn" x="640" y="452" width="150" height="66" rx="18"/>
    <rect class="furn-2" x="652" y="440" width="126" height="20" rx="10"/>
    <ellipse class="furn-3" cx="715" cy="562" rx="48" ry="30"/>
    <circle class="accent-soft" cx="698" cy="558" r="9"/>
    <circle class="accent-soft" cx="732" cy="564" r="9"/>`;

  /* --- personal shelf (workspace) --- */
  const shelf = `
    <rect class="furn" x="56" y="150" width="46" height="120" rx="10"/>
    <line class="ink" x1="62" y1="190" x2="96" y2="190"/>
    <line class="ink" x1="62" y1="230" x2="96" y2="230"/>
    <circle class="accent-soft" cx="79" cy="170" r="9"/>`;

  /* --- locker: the employee's own employment self-service --- */
  const locker = `
    <rect class="furn" x="404" y="452" width="46" height="88" rx="8"/>
    <line class="ink" x1="412" y1="480" x2="442" y2="480"/>
    <circle class="accent-soft" cx="441" cy="498" r="5"/>`;

  /* --- filing cabinet: the HR system of record.
         Sits below the meeting-room partition, in the space an organisation
         account has to itself — clear of the meeting table above. --- */
  const files = `
    <rect class="furn" x="736" y="392" width="96" height="126" rx="10"/>
    <line class="ink" x1="750" y1="428" x2="818" y2="428"/>
    <line class="ink" x1="750" y1="462" x2="818" y2="462"/>
    <line class="ink" x1="750" y1="496" x2="818" y2="496"/>
    <circle class="accent-soft" cx="784" cy="410" r="6"/>`;

  /* --- meeting room contents (org) --- */
  const meeting = `
    <ellipse class="furn" cx="812" cy="150" rx="104" ry="58"/>
    <circle class="furn-2" cx="716" cy="150" r="18"/>
    <circle class="furn-2" cx="908" cy="150" r="18"/>
    <circle class="furn-2" cx="770" cy="76"  r="18"/>
    <circle class="furn-2" cx="854" cy="76"  r="18"/>
    <circle class="furn-2" cx="770" cy="224" r="18"/>
    <circle class="furn-2" cx="854" cy="224" r="18"/>`;

  /* Resolve a spot's current destination — the journal points at setup until
     it has been completed once, so onboarding is reachable from the room. */
  const by = (id) => {
    const s = SPOTS.find((x) => x.id === id);
    return (s.altWhen && s.altWhen())
      ? Object.assign({}, s, { href: s.altHref, sub: s.altSub })
      : s;
  };

  /* An organisation account gets the meeting room and nothing else. The
     employee floor is not drawn as furniture they cannot use — it is drawn
     as a sealed area, because an HR leader has no business seeing whose desk
     is whose. The wall is the point. */
  const employeeFloor = !own ? `
    <g class="sealed" aria-hidden="true">
      <rect class="sealed__fill" x="52" y="52" width="546" height="616" rx="16"/>
      <g transform="translate(325 330)">
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
    ${spotOpen(by('desk'), desk, 216, 530)}
    ${spotOpen(by('journal'), journal, 296, 300)}
    ${spotOpen(by('cooler'), cooler, 520, 566)}
    ${spotOpen(
        Object.assign({}, by('clock'), { sub: formatTime(mins) }),
        clock, 330, 122)}
    ${spotOpen(by('lounge'), lounge, 715, 624)}
    ${spotOpen(by('shelf'), shelf, 79, 300)}
    ${spotOpen(by('locker'), locker, 427, 578)}`;

  return `
  <svg class="room__svg" viewBox="0 0 1000 720" role="img"
       aria-label="Top-down plan of the office. Use the destination buttons, or switch to the list view.">

    <!-- floor & outer wall -->
    <rect class="floor" x="24" y="24" width="952" height="672" rx="22"/>
    <rect class="wall"  x="24" y="24" width="952" height="672" rx="22"/>

    ${own ? '<rect class="rug" x="360" y="300" width="230" height="150" rx="16"/>' : ''}

    <!-- lit pools go over the floor and under the furniture, so the light
         falls on the room rather than washing across the top of it -->
    ${lights}

    <!-- meeting room partition, with its doorway gap -->
    <path class="wall-inner" d="M626 24 L626 270 L700 270 M772 270 L976 270"/>

    <!-- badge reader beside the meeting room door -->
    <rect class="reader ${org ? 'is-open' : ''}" x="778" y="278" width="14" height="24" rx="4"/>

    ${employeeFloor}

    ${org ? spotOpen(by('files'), files, 784, 556) : ''}

    ${org
      ? spotOpen(by('meeting'), meeting, 812, 250)
      : spotLocked(by('meeting'), meeting, 812, 250,
          'Your account cannot open this room. It holds group data only.')}

    <!-- front doors: two leaves that swing inward on sign-in -->
    <g class="doors">
      <rect class="doorleaf doorleaf--l" x="430" y="686" width="70" height="16" rx="6"/>
      <rect class="doorleaf doorleaf--r" x="500" y="686" width="70" height="16" rx="6"/>
    </g>

    <!-- the sign-in target, only hittable while locked -->
    <g class="frontdoor" data-frontdoor tabindex="0" role="button"
       aria-label="Front door — sign in to enter">
      <rect class="frontdoor__hit" x="416" y="656" width="168" height="60" rx="14"/>
      <circle class="frontdoor__pulse" cx="500" cy="686" r="46"/>
      ${tag(500, 640, 'Front door', 'Sign in')}
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

/** Makes the objects in a rendered room navigable. */
function wireRoom(container, opts) {
  const o = opts || {};

  const go = (el) => {
    if (el.classList.contains('spot--locked')) {
      container.dispatchEvent(new CustomEvent('ww:roomlocked', {
        bubbles: true, detail: { spot: el.dataset.spot },
      }));
      return;
    }
    const href = el.dataset.go;
    if (href) location.href = href;
  };

  container.addEventListener('click', (e) => {
    const front = e.target.closest('[data-frontdoor]');
    if (front) {
      container.dispatchEvent(new CustomEvent('ww:frontdoor', { bubbles: true }));
      return;
    }
    const spot = e.target.closest('.spot');
    if (spot && !o.locked?.()) go(spot);
  });

  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const front = e.target.closest?.('[data-frontdoor]');
    const spot = e.target.closest?.('.spot');
    if (!front && !spot) return;
    e.preventDefault();
    if (front) container.dispatchEvent(new CustomEvent('ww:frontdoor', { bubbles: true }));
    else if (!o.locked?.()) go(spot);
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

  // Organisation destinations are always listed, open or locked, because a
  // closed door is information. A private one is listed only to whoever
  // holds that plane — it is not anyone else's to know the shape of.
  const visible = SPOTS.filter((s) => (s.plane === 'org' ? true : own));

  const items = visible.map((base) => {
    const s = (base.altWhen && base.altWhen())
      ? Object.assign({}, base, { href: base.altHref, sub: base.altSub })
      : base;
    const open = (s.plane === 'org' ? org : own) && !locked;
    if (open) {
      return `<li><a class="roomlist__item" href="${s.href}">
           <span class="roomlist__label">${s.label}</span>
           <span class="roomlist__sub">${s.sub}</span></a></li>`;
    }
    const why = locked ? 'Sign in first' : 'Locked — holds group data only';
    return `<li><span class="roomlist__item is-locked" aria-disabled="true">
           <span class="roomlist__label">${s.label}</span>
           <span class="roomlist__sub">${why}</span></span></li>`;
  }).join('');

  const note = org && !own && !locked
    ? `<li><span class="roomlist__item is-locked" aria-disabled="true">
         <span class="roomlist__label">Private plane</span>
         <span class="roomlist__sub">Employees only — sealed from your account</span>
       </span></li>`
    : '';

  return `<ul class="roomlist">${items}${note}</ul>`;
}

WW.room = {
  SPOTS, roomSVG, wireRoom, roomList,
  nowMinutes, phaseAt, quietHours, formatTime,
};

})(window.WW);
