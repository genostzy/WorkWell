/* ==========================================================================
   WorkWell — App shell
   Renders navigation chrome from a single config so the nine screens stay in
   sync, and owns the global preferences (theme, motion, contrast, density).

   Classic script (not a module) so the app runs from file://.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

const icon = WW.icon;
const brandmark = WW.brandmark;

/* ---------------------------------------------------------------- Config */

/* The badge is per-plane, the navigation is per-side. Keeping them in one
   object made `work` inherit the private badge, so My Leave promised that the
   employer could never see it directly above a card saying they do. */
const BADGES = {
  private: {
    icon: 'lock',
    label: 'Private Plane',
    sub: 'Only you can see anything here. Your employer never can.',
  },
  work: {
    icon: 'inbox',
    label: 'Work Plane',
    sub: 'Your own employment record. HR sees this too.',
  },
  hr: {
    icon: 'users',
    label: 'HR Plane',
    sub: 'Employment records only. Never wellbeing data.',
  },
  org: {
    icon: 'building',
    label: 'Organization Plane',
    sub: 'Group patterns are anonymous. Employment records are individual, by design.',
  },
};

const NAV = {
  private: {
    name: 'Private',
    groups: [
      {
        heading: 'Reflect',
        items: [
          { id: 'trends',      href: 'trends.html',      label: 'Your Trends',    icon: 'trend' },
          { id: 'check-in',    href: 'check-in.html',    label: 'Daily Check-in', icon: 'heart' },
        ],
      },
      {
        heading: 'Support',
        items: [
          { id: 'nudges',      href: 'nudges.html',      label: 'Health Nudges',  icon: 'bell' },
          { id: 'boundary',    href: 'boundary.html',    label: 'Boundaries',     icon: 'moon' },
          { id: 'recognition', href: 'recognition.html', label: 'Recognition',    icon: 'users' },
        ],
      },
      {
        heading: 'Personalise',
        items: [
          { id: 'workspace',   href: 'workspace.html',   label: 'Workspace',      icon: 'sliders' },
        ],
      },
      {
        heading: 'Employment',
        items: [
          { id: 'my-leave',    href: 'my-leave.html',    label: 'My Leave',       icon: 'calendar' },
          { id: 'my-profile',  href: 'my-profile.html',  label: 'My Profile',     icon: 'inbox' },
        ],
      },
    ],
    /* Bottom tab bar: four highest-frequency destinations, rest behind More. */
    tabs: ['trends', 'check-in', 'recognition'],
  },

  org: {
    name: 'Organization',
    groups: [
      {
        heading: 'People',
        items: [
          { id: 'hr-people',      href: 'hr-people.html',      label: 'Directory',   icon: 'users' },
          { id: 'hr-leave',       href: 'hr-leave.html',       label: 'Leave',       icon: 'calendar' },
          { id: 'hr-performance', href: 'hr-performance.html', label: 'Performance', icon: 'target' },
          { id: 'hr-onboarding',  href: 'hr-onboarding.html',  label: 'Onboarding',  icon: 'seedling' },
        ],
      },
      {
        heading: 'Diagnose',
        items: [
          { id: 'org-diagnostics', href: 'org-diagnostics.html', label: 'Structural Load', icon: 'chart' },
        ],
      },
    ],
    tabs: ['hr-people', 'hr-leave', 'org-diagnostics'],
  },
};

/* Pages carry four plane values but navigation has two sides: `private` and
   `work` are both the employee's, `hr` and `org` are both the employer's. */
function navFor(plane) {
  return (plane === 'hr' || plane === 'org') ? NAV.org : NAV.private;
}

/** The badge, unlike the navigation, is specific to the page's own plane. */
function badgeFor(plane) {
  return BADGES[plane] || BADGES.private;
}

/* Signed-in identity. Display only — set at sign-in, never a credential. */
const DEFAULT_USER = {
  name: 'Celine Nolasco',
  email: 'celine.nolasco@northwind.example',
  role: 'Employee',
  initials: 'CN',
  plane: 'employee',
};

/**
 * Which planes an account may open.
 *
 *   private  wellbeing — mood, trends, boundaries, nudges. Employee only, ever.
 *   work     the employee's own employment data — leave, payslips, profile.
 *   hr       the employment system of record — directory, leave, reviews.
 *   org      anonymous group aggregates, N>=8.
 *
 * An HR manager legitimately sees that someone has 12 days of leave left.
 * They never see how that person's week felt: `private` is not in their list
 * and no permission level adds it. That is the whole product.
 */
const PLANES = {
  employee: ['private', 'work'],
  hr:       ['hr', 'org'],
};

function allowedPlanes(user) {
  return PLANES[user.plane === 'hr' ? 'hr' : 'employee'];
}

function allowedPlane(user) {
  return allowedPlanes(user)[0];   // where "go to your plane" lands
}

function blockScreen(pagePlane, user) {
  const home = user.plane === 'hr' ? 'hr-people.html' : 'trends.html';
  const what = {
    private: 'This is an employee\'s private plane — wellbeing data. Your account cannot open it, and no permission level adds it.',
    work:    'This is an employee\'s own employment self-service. Manage people from the HR directory instead.',
    hr:      'This is the HR system of record. Your account does not have it.',
    org:     'This is the organisation plane. It holds group data for leadership, and your account does not have it.',
  }[pagePlane] || 'Your account cannot open this screen.';
  return `
    <div class="page-head">
      <h1>Not available on this account</h1>
      <p class="t-lead">${what}</p>
    </div>
    <div class="card">
      <div class="state">
        <div class="state__icon">${icon('lock', { size: 25 })}</div>
        <h2 class="state__title">The wall is doing its job</h2>
        <p class="state__text">Signed in as <b>${user.name}</b> — ${user.role}.
          There is no permission level that opens both planes.</p>
        <div class="state__actions row" style="justify-content:center">
          <a class="btn btn--primary" href="${home}">Go to your plane</a>
          <a class="btn btn--secondary" href="index.html">The office</a>
        </div>
      </div>
    </div>`;
}

function currentUser() {
  try {
    const raw = localStorage.getItem('ww.user');
    return raw ? Object.assign({}, DEFAULT_USER, JSON.parse(raw)) : DEFAULT_USER;
  } catch (e) {
    return DEFAULT_USER;
  }
}

function signOut() {
  try { localStorage.removeItem('ww.user'); } catch (e) { /* ignore */ }
  location.href = 'index.html';
}

/* ------------------------------------------------------------ Preferences */

const PREFS = {
  theme:    { attr: 'data-theme',    key: 'ww.theme',    values: ['system', 'light', 'dark'],                 def: 'system' },
  motion:   { attr: 'data-motion',   key: 'ww.motion',   values: ['system', 'full', 'reduced'],               def: 'system' },
  contrast: { attr: 'data-contrast', key: 'ww.contrast', values: ['normal', 'high'],                          def: 'normal' },
  density:  { attr: 'data-density',  key: 'ww.density',  values: ['compact', 'comfortable', 'spacious'],      def: 'comfortable' },
};

function getPref(name) {
  try {
    return localStorage.getItem(PREFS[name].key) || PREFS[name].def;
  } catch (e) {
    return PREFS[name].def;
  }
}

function setPref(name, value) {
  const spec = PREFS[name];
  if (!spec || !spec.values.includes(value)) return;
  try { localStorage.setItem(spec.key, value); } catch (e) { /* private browsing */ }
  applyPref(name, value);
  document.dispatchEvent(new CustomEvent('ww:pref', { detail: { name, value } }));
}

function applyPref(name, value) {
  const { attr, def } = PREFS[name];
  const root = document.documentElement;
  // "system" and the default mean: remove the attribute and let CSS decide.
  if (value === 'system' || value === def && (name === 'contrast')) {
    root.removeAttribute(attr);
  } else {
    root.setAttribute(attr, value);
  }
}

function applyAllPrefs() {
  Object.keys(PREFS).forEach((n) => applyPref(n, getPref(n)));
}

/* Apply before first paint to avoid a flash of the wrong theme. */
applyAllPrefs();

/* ------------------------------------------------------------ Shell build */

function navLink(item, currentId, cls = 'navlink') {
  const active = item.id === currentId ? ' aria-current="page"' : '';
  return `<a class="${cls}" href="${item.href}"${active}>${icon(item.icon)}<span>${item.label}</span></a>`;
}

function buildSidebar(plane, currentId) {
  const cfg = navFor(plane);
  const badge = badgeFor(plane);
  const user = currentUser();
  const home = cfg.groups[0].items[0].href;

  const groups = cfg.groups.map((g) => `
    <div class="sidebar__section">
      <div class="sidebar__heading">${g.heading}</div>
      ${g.items.map((i) => navLink(i, currentId)).join('')}
    </div>`).join('');

  return `
    <aside class="sidebar">
      <a class="sidebar__brand" href="${home}">
        <span class="sidebar__mark">${brandmark({ size: 34 })}</span>
        <span class="sidebar__name">WorkWell</span>
      </a>

      <div class="plane-badge">
        ${icon(badge.icon, { size: 17 })}
        <div>
          <div class="plane-badge__label">${badge.label}</div>
          <div class="plane-badge__sub">${badge.sub}</div>
        </div>
      </div>

      <nav aria-label="${cfg.name}">${groups}</nav>

      <div class="sidebar__foot">
        ${accountBlock(user)}
      </div>
    </aside>`;
}

/* Account control + its menu. The menu is the only route to signing out.
   Returns the inner parts only — the caller supplies the .account wrapper,
   so the same block works in the topbar or anywhere else. */
function accountBlock(user) {
  return `
    <button class="account__btn" type="button" data-account-menu
            aria-haspopup="true" aria-expanded="false">
      <span class="avatar avatar--sm">${user.initials}</span>
      <span class="account__text">
        <span class="account__name">${user.name}</span>
        <span class="account__role">${user.role}</span>
      </span>
    </button>

    <div class="account__menu" hidden role="menu" aria-label="Account">
      <div class="account__head">
        <span class="avatar">${user.initials}</span>
        <div style="min-width:0">
          <div class="account__name">${user.name}</div>
          <div class="account__email">${user.email}</div>
        </div>
      </div>
      <a class="account__item" href="index.html" role="menuitem">
        ${icon('grid', { size: 17 })} The office
      </a>
      ${user.plane === 'hr' ? '' : `
      <a class="account__item" href="workspace.html" role="menuitem">
        ${icon('sliders', { size: 17 })} Settings
      </a>`}
      <button class="account__item account__item--sep" type="button"
              role="menuitem" data-sign-out>
        ${icon('arrowRight', { size: 17 })} Sign out
      </button>
    </div>`;
}

function buildTopbar(title, plane) {
  const badge = badgeFor(plane);
  const user = currentUser();
  return `
    <header class="topbar">
      <a class="topbar__home" href="index.html" aria-label="Back to the office">
        <span class="sidebar__mark">${brandmark({ size: 30 })}</span>
      </a>
      <span class="topbar__title">${title}</span>
      <span class="topbar__spacer"></span>
      <div class="topbar__actions">
        <span class="chip chip--accent" title="${badge.sub}">
          ${icon(badge.icon, { size: 13 })}${badge.label}
        </span>
        <button class="iconbtn" type="button" data-theme-toggle
                aria-label="Switch colour theme" title="Switch colour theme"></button>
        <div class="account account--top">${accountBlock(user)}</div>
      </div>
    </header>`;
}

function buildTabbar(plane, currentId) {
  const cfg = navFor(plane);
  const all = cfg.groups.flatMap((g) => g.items);
  const primary = cfg.tabs.map((id) => all.find((i) => i.id === id)).filter(Boolean);
  const overflow = all.filter((i) => !cfg.tabs.includes(i.id));

  const moreActive = overflow.some((i) => i.id === currentId) ? ' aria-current="page"' : '';

  return `
    <nav class="tabbar" aria-label="Primary">
      ${primary.map((i) => navLink(i, currentId, '')).join('')}
      <a href="#" data-more-tab${moreActive}>${icon('more')}<span>More</span></a>
    </nav>`;
}

function buildPlaneStrip(plane) {
  const badge = badgeFor(plane);
  return `<div class="plane-strip">${icon(badge.icon, { size: 14 })}<span>${badge.label} — ${badge.sub}</span></div>`;
}

/* ------------------------------------------------------------ More sheet */

function openMoreSheet(plane, currentId) {
  const cfg = navFor(plane);
  const user = currentUser();
  const all = cfg.groups.flatMap((g) => g.items);
  const overflow = all.filter((i) => !cfg.tabs.includes(i.id));

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="More">
      <div class="row row--between" style="padding:var(--s-5) var(--s-5) var(--s-3)">
        <h2 style="font-size:var(--fs-lg)">More</h2>
        <button class="iconbtn" type="button" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="sidebar__section" style="padding:0 var(--s-3) var(--s-4)">
        ${overflow.map((i) => navLink(i, currentId)).join('')}
      </div>
      <div class="sheet__foot">
        <div class="account__head" style="padding:0 0 var(--s-3)">
          <span class="avatar">${user.initials}</span>
          <div style="min-width:0">
            <div class="account__name">${user.name}</div>
            <div class="account__email">${user.email}</div>
          </div>
        </div>
        <button class="btn btn--secondary btn--block" type="button" data-sign-out>
          ${icon('arrowRight', { size: 17 })} Sign out
        </button>
      </div>
    </div>`;

  const close = () => { backdrop.remove(); document.body.style.overflow = ''; };
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  document.body.append(backdrop);
  document.body.style.overflow = 'hidden';
  backdrop.querySelector('a, button')?.focus();
}

/* --------------------------------------------------------- Theme toggle */

function themeIcon() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
    || (getPref('theme') === 'system'
        && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return icon(dark ? 'sun' : 'moonFill');
}

function refreshThemeToggles() {
  document.querySelectorAll('[data-theme-toggle]').forEach((b) => { b.innerHTML = themeIcon(); });
}

function cycleTheme() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
    || (getPref('theme') === 'system'
        && window.matchMedia('(prefers-color-scheme: dark)').matches);
  setPref('theme', dark ? 'light' : 'dark');
  refreshThemeToggles();
}

/* -------------------------------------------------------- State switcher */

/**
 * Builds the design-review state switcher for any [data-state-group].
 * Panels declare themselves, so a screen can never advertise a state it does
 * not implement. Hidden unless asked for — the app should look finished.
 */
function initStateSwitcher() {
  document.querySelectorAll('[data-state-group]').forEach((group) => {
    const panels = [...group.querySelectorAll('[data-state-panel]')];
    if (panels.length < 2) return;

    const bar = document.createElement('div');
    bar.className = 'statebar';
    bar.innerHTML = `
      <span class="statebar__label">${icon('eye', { size: 14 })} Screen state</span>
      <div class="segmented" role="group" aria-label="Preview screen state">
        ${panels.map((p, idx) => `
          <button type="button" data-state="${p.dataset.statePanel}"
            aria-pressed="${idx === 0}">${p.dataset.stateLabel || p.dataset.statePanel}</button>`).join('')}
      </div>`;

    group.before(bar);

    const show = (name) => {
      panels.forEach((p) => p.classList.toggle('is-active', p.dataset.statePanel === name));
      bar.querySelectorAll('[data-state]').forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.state === name)));
      document.dispatchEvent(new CustomEvent('ww:state', { detail: { name, group } }));
    };

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-state]');
      if (btn) show(btn.dataset.state);
    });

    // Deep-link: ?state=empty — which also reveals the switcher.
    const wanted = new URLSearchParams(location.search).get('state');
    const known = panels.some((p) => p.dataset.statePanel === wanted);
    if (known) bar.classList.add('is-visible');
    show(known ? wanted : panels[0].dataset.statePanel);
  });

  // Ctrl+Alt+S reveals the switcher on any screen.
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      document.querySelectorAll('.statebar').forEach((b) => b.classList.toggle('is-visible'));
    }
  });
}

/* ------------------------------------------------------- Icon hydration */

/**
 * Replaces <span data-icon="bell"> placeholders with inline SVG, so page
 * markup stays readable and icons never duplicate across files.
 * Re-runnable: page scripts call it again after injecting markup.
 */
function hydrateIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach((el) => {
    const svg = icon(el.dataset.icon, {
      size: Number(el.dataset.size) || 20,
      label: el.dataset.label || null,
    });
    if (svg) el.outerHTML = svg;
  });
}

/* --------------------------------------------------------- Generic wiring */

/** Switches and pressed-state buttons work everywhere without per-page code. */
function initControls() {
  document.addEventListener('click', (e) => {
    const sw = e.target.closest('.switch');
    if (sw) {
      const on = sw.getAttribute('aria-checked') === 'true';
      sw.setAttribute('aria-checked', String(!on));
      sw.dispatchEvent(new CustomEvent('ww:toggle', { bubbles: true, detail: { on: !on } }));
      return;
    }

    const seg = e.target.closest('.segmented button, .optgrid .opt');
    if (seg && !seg.closest('.statebar')) {
      const scope = seg.closest('.segmented, .optgrid');
      if (scope && !scope.hasAttribute('data-multi')) {
        scope.querySelectorAll('[aria-pressed]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      }
      seg.setAttribute('aria-pressed', String(!scope?.hasAttribute('data-multi') || seg.getAttribute('aria-pressed') !== 'true'));
      seg.dispatchEvent(new CustomEvent('ww:select', { bubbles: true, detail: { value: seg.dataset.value } }));
      return;
    }

    const more = e.target.closest('[data-privacy-more]');
    if (more) {
      const detail = more.parentElement.querySelector('.privacy-detail');
      const open = more.getAttribute('aria-expanded') === 'true';
      more.setAttribute('aria-expanded', String(!open));
      more.textContent = open ? 'What this means' : 'Show less';
      if (detail) detail.hidden = open;
      return;
    }

    const chip = e.target.closest('button.chip[aria-pressed]');
    if (chip) {
      chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
      chip.dispatchEvent(new CustomEvent('ww:select', { bubbles: true, detail: { value: chip.dataset.value } }));
    }
  });

  // Range fill so the track reads as a filled progress bar in WebKit too.
  document.querySelectorAll('.range').forEach((r) => {
    const paint = () => {
      const pct = ((r.value - r.min) / (r.max - r.min)) * 100;
      r.style.setProperty('--fill', `${pct}%`);
    };
    r.addEventListener('input', paint);
    paint();
  });
}

/* ------------------------------------------------------------------ Init */

/* The room replaces the sidebar: one button that opens the office plan.
   Kept as a real dialog so it is keyboard-operable and dismissible. */
function openHub() {
  const user = currentUser();
  // Role comes from the account, never from the page — otherwise an employee
  // landing on an org URL would be handed the org room.
  const role = user.plane === 'hr' ? 'hr' : 'employee';

  const overlay = document.createElement('div');
  overlay.className = 'hub-overlay';
  overlay.innerHTML = `
    <div class="hub-panel" role="dialog" aria-modal="true" aria-label="The office">
      <div class="row row--between mb-4">
        <div>
          <h2 style="font-size:var(--fs-lg)">Where next?</h2>
          <p class="t-subtle">Everything in the room is a destination.</p>
        </div>
        <button class="iconbtn" type="button" data-hub-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="room" data-room data-open="true"></div>
      <details class="table-view mt-4">
        <summary>View as a list</summary>
        ${WW.room ? WW.room.roomList(role) : ''}
      </details>
    </div>`;

  const roomEl = overlay.querySelector('[data-room]');
  if (WW.room) {
    roomEl.insertAdjacentHTML('afterbegin', WW.room.roomSVG({ role }));
    const you = roomEl.querySelector('.room-avatar__initials');
    if (you) you.textContent = user.initials;
    WW.room.wireRoom(roomEl, { locked: () => false });
  }

  const close = () => { overlay.remove(); document.body.style.overflow = ''; };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-hub-close]')) close();
  });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  document.body.append(overlay);
  document.body.style.overflow = 'hidden';
  overlay.querySelector('.spot, [data-hub-close]')?.focus();
}

function mountShell() {
  const body = document.body;
  const plane = body.dataset.plane || 'private';
  const page = body.dataset.page || '';
  const title = body.dataset.title || document.title.replace(/ — WorkWell$/, '');

  // No sidebar: navigation is the office plan, reached from the hub button.
  const app = document.createElement('div');
  app.className = 'app';

  const main = document.createElement('div');
  main.className = 'main';
  main.innerHTML = buildTopbar(title, plane) + buildPlaneStrip(plane);

  const content = document.querySelector('[data-content]');

  /* Enforce the plane before anything renders, so page scripts find no
     hooks and never populate a screen this account may not see.
     data-access="any" exempts the design-system reference, which is
     documentation rather than a product screen. */
  const user = currentUser();
  const exempt = body.dataset.access === 'any';
  if (!exempt && allowedPlanes(user).indexOf(plane) === -1) {
    content.innerHTML = blockScreen(plane, user);
    body.dataset.blocked = 'true';
  }

  main.append(content);
  app.append(main);

  body.prepend(app);
  body.insertAdjacentHTML('beforeend', buildTabbar(plane, page));
  body.insertAdjacentHTML('beforeend', `
    <button class="hub" type="button" data-hub aria-haspopup="dialog">
      <span class="hub__glyph">${icon('grid', { size: 17 })}</span>
      <span>The office</span>
    </button>`);
  body.insertAdjacentHTML('afterbegin',
    '<a class="skip-link" href="#main-content">Skip to main content</a>');

  content.id = 'main-content';
  content.setAttribute('tabindex', '-1');

  refreshThemeToggles();

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-theme-toggle]')) { e.preventDefault(); cycleTheme(); }
    if (e.target.closest('[data-more-tab]'))     { e.preventDefault(); openMoreSheet(plane, page); }
    if (e.target.closest('[data-hub]'))          { e.preventDefault(); openHub(); }
    if (e.target.closest('[data-sign-out]'))     { e.preventDefault(); signOut(); }

    const trigger = e.target.closest('[data-account-menu]');
    const menu = document.querySelector('.account__menu');
    if (!menu) return;

    if (trigger) {
      e.preventDefault();
      const open = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!open));
      menu.hidden = open;
    } else if (!e.target.closest('.account__menu')) {
      menu.hidden = true;
      document.querySelector('[data-account-menu]')?.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const menu = document.querySelector('.account__menu');
    if (menu && !menu.hidden) {
      menu.hidden = true;
      const t = document.querySelector('[data-account-menu]');
      t?.setAttribute('aria-expanded', 'false');
      t?.focus();
    }
  });

  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', refreshThemeToggles);

  hydrateIcons();
  initStateSwitcher();
  initControls();

  mounted = true;
  document.dispatchEvent(new CustomEvent('ww:ready'));
}

let mounted = false;

/** Run a page script once the shell exists, whenever that happens to be. */
function onReady(fn) {
  if (mounted) fn();
  else document.addEventListener('ww:ready', fn, { once: true });
}

/* ----------------------------------------------------- Completion feedback */

/**
 * Replace an action with an inline confirmation, and return the panel.
 *
 * `host` is the element holding the action — usually the button row, so the
 * whole row of choices resolves together rather than leaving a live button
 * beside a spent one.
 *
 * Inline rather than a toast: the confirmation stays where the action
 * happened and does not time out, which extends the pattern flow.js already
 * ends check-in with instead of introducing a competing one.
 *
 * Nothing is sent anywhere — there is no backend. Messages must be worded so
 * they do not imply a request was transmitted.
 */
function confirmAction(host, message) {
  if (!host) return null;

  const hadFocus = host.contains(document.activeElement);

  const panel = document.createElement('div');
  panel.className = 'confirmed';
  panel.setAttribute('role', 'status');
  panel.tabIndex = -1;
  panel.innerHTML =
    '<svg class="confirmed__mark" width="22" height="22" viewBox="0 0 24 24"'
    + ' aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4"'
    + ' stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="m4 12 5 5L20 6"/></svg>'
    + '<span class="confirmed__text"></span>';

  host.replaceWith(panel);

  // A live region that arrives with its text already in place is not
  // reliably announced — the region has to be in the document before the
  // text changes. A timer rather than requestAnimationFrame, which does not
  // run in a hidden or backgrounded tab and would leave the panel blank.
  setTimeout(() => {
    panel.querySelector('.confirmed__text').textContent = message;
  }, 0);

  // Replacing the host destroys whatever had focus, which would drop a
  // keyboard user back to the top of the document.
  if (hadFocus) panel.focus({ preventScroll: true });

  return panel;
}

WW.getPref = getPref;
WW.setPref = setPref;
WW.mountShell = mountShell;
WW.hydrateIcons = hydrateIcons;
WW.onReady = onReady;
WW.confirmAction = confirmAction;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountShell);
} else {
  mountShell();
}

})(window.WW);
