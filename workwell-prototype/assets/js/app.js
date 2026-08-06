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

/* ---------------------------------------------------------------- Config */

const NAV = {
  private: {
    name: 'Private',
    badge: {
      icon: 'lock',
      label: 'Private Plane',
      sub: 'Only you can see anything here. Your employer never can.',
    },
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
    ],
    /* Bottom tab bar: four highest-frequency destinations, rest behind More. */
    tabs: ['trends', 'check-in', 'recognition'],
  },

  org: {
    name: 'Organization',
    badge: {
      icon: 'building',
      label: 'Organization Plane',
      sub: 'Anonymous group patterns only. Never individuals, never groups under 8.',
    },
    groups: [
      {
        heading: 'Diagnose',
        items: [
          { id: 'org-diagnostics', href: 'org-diagnostics.html', label: 'Structural Load', icon: 'chart' },
        ],
      },
    ],
    tabs: ['org-diagnostics'],
  },
};

/* Signed-in identity. Display only — set at sign-in, never a credential. */
const DEFAULT_USER = {
  name: 'Alex Rivera',
  email: 'alex.rivera@northwind.example',
  role: 'Employee',
  initials: 'AR',
};

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
  const cfg = NAV[plane];
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
        <span class="sidebar__mark">${icon('seedling', { size: 19 })}</span>
        <span class="sidebar__name">WorkWell</span>
      </a>

      <div class="plane-badge">
        ${icon(cfg.badge.icon, { size: 17 })}
        <div>
          <div class="plane-badge__label">${cfg.badge.label}</div>
          <div class="plane-badge__sub">${cfg.badge.sub}</div>
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
      <a class="account__item" href="workspace.html" role="menuitem">
        ${icon('sliders', { size: 17 })} Settings
      </a>
      <button class="account__item account__item--sep" type="button"
              role="menuitem" data-sign-out>
        ${icon('arrowRight', { size: 17 })} Sign out
      </button>
    </div>`;
}

function buildTopbar(title, plane) {
  const cfg = NAV[plane];
  const user = currentUser();
  return `
    <header class="topbar">
      <a class="topbar__home" href="index.html" aria-label="Back to the office">
        <span class="sidebar__mark">${icon('seedling', { size: 17 })}</span>
      </a>
      <span class="topbar__title">${title}</span>
      <span class="topbar__spacer"></span>
      <div class="topbar__actions">
        <span class="chip chip--accent" title="${cfg.badge.sub}">
          ${icon(cfg.badge.icon, { size: 13 })}${cfg.badge.label}
        </span>
        <button class="iconbtn" type="button" data-theme-toggle
                aria-label="Switch colour theme" title="Switch colour theme"></button>
        <div class="account account--top">${accountBlock(user)}</div>
      </div>
    </header>`;
}

function buildTabbar(plane, currentId) {
  const cfg = NAV[plane];
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
  const cfg = NAV[plane];
  return `<div class="plane-strip">${icon(cfg.badge.icon, { size: 14 })}<span>${cfg.badge.label} — ${cfg.badge.sub}</span></div>`;
}

/* ------------------------------------------------------------ More sheet */

function openMoreSheet(plane, currentId) {
  const cfg = NAV[plane];
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
function openHub(plane) {
  const user = currentUser();
  const role = user.plane === 'hr' || plane === 'org' ? 'hr' : 'employee';

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
    if (e.target.closest('[data-hub]'))          { e.preventDefault(); openHub(plane); }
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

WW.getPref = getPref;
WW.setPref = setPref;
WW.mountShell = mountShell;
WW.hydrateIcons = hydrateIcons;
WW.onReady = onReady;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountShell);
} else {
  mountShell();
}

})(window.WW);
