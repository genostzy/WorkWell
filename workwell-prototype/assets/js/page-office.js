/* ==========================================================================
   WorkWell — The office (home)

   Locked until you click the front door. Signing in opens the doors, lights
   the room, walks you in, and offers the check-in.

   Demonstration only: nothing authenticates. Signing in records a display
   name and role so the room knows which doors you may open.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

const icon = WW.icon;
const KEY = 'ww.user';

/* Apply stored display prefs before paint, matching the rest of the app. */
(function applyPrefs() {
  const map = {
    'ww.theme': 'data-theme', 'ww.motion': 'data-motion',
    'ww.contrast': 'data-contrast', 'ww.density': 'data-density',
  };
  Object.keys(map).forEach((k) => {
    let v = null;
    try { v = localStorage.getItem(k); } catch (e) { /* private browsing */ }
    if (v && v !== 'system' && !(k === 'ww.contrast' && v === 'normal')) {
      document.documentElement.setAttribute(map[k], v);
    }
  });
})();

function readUser() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function hydrate(root) {
  (root || document).querySelectorAll('[data-icon-slot]').forEach((el) => {
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.iconSlot, { size: 18 }));
    el.removeAttribute('data-icon-slot');
  });
}

function prefersReducedMotion() {
  const attr = document.documentElement.getAttribute('data-motion');
  if (attr === 'reduced') return true;
  if (attr === 'full') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

document.addEventListener('DOMContentLoaded', function () {
  const roomEl = document.querySelector('[data-room]');
  const dim = roomEl.querySelector('.room__dim');
  const bubble = document.querySelector('[data-bubble]');
  const signin = document.querySelector('[data-signin]');
  const caption = document.querySelector('[data-room-caption]');
  const hint = document.querySelector('[data-room-hint]');
  const listNote = document.querySelector('[data-list-note]');
  const listHost = document.querySelector('[data-room-list]');
  const acctSlot = document.querySelector('[data-account-slot]');

  let user = readUser();
  let signedIn = !!user;

  /* ---------------------------------------------------------- Rendering */

  function planeRole() { return user && user.plane === 'hr' ? 'hr' : 'employee'; }

  function renderRoom() {
    const mins = WW.room.nowMinutes();
    roomEl.dataset.phase = WW.room.phaseAt(mins);
    roomEl.insertAdjacentHTML('afterbegin',
      WW.room.roomSVG({ role: planeRole(), minutes: mins }));
    listHost.innerHTML = WW.room.roomList(planeRole(), !signedIn);
    // The list is the default view on phones, so it needs its own way in.
    if (!signedIn) {
      listHost.insertAdjacentHTML('afterbegin', `
        <button class="btn btn--primary btn--block mb-4" type="button" data-list-signin>
          Sign in to come in
        </button>`);
    }
  }

  function renderAccount() {
    if (!signedIn) { acctSlot.hidden = true; return; }
    acctSlot.hidden = false;
    acctSlot.innerHTML = `
      <button class="account__btn" type="button" data-account-menu
              aria-haspopup="true" aria-expanded="false" style="width:auto">
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
        <a class="account__item" href="workspace.html" role="menuitem">
          ${icon('sliders', { size: 17 })} Settings</a>
        <button class="account__item account__item--sep" type="button"
                role="menuitem" data-sign-out>
          ${icon('arrowRight', { size: 17 })} Sign out</button>
      </div>`;
  }

  /* ------------------------------------------------------------- States */

  function setOpen(open, opts) {
    const o = opts || {};
    roomEl.dataset.open = String(open);
    if (dim) dim.style.opacity = open ? '0' : '1';

    const avatar = roomEl.querySelector('.room-avatar__initials');
    if (avatar && user) avatar.textContent = user.initials;

    const mins = WW.room.nowMinutes();
    const phase = WW.room.phaseAt(mins);
    const first = user ? user.name.split(' ')[0] : 'there';

    caption.textContent = open
      ? ({
          morning: `Morning, ${first}. Pick somewhere to go.`,
          day:     `Afternoon, ${first}. Pick somewhere to go.`,
          quiet:   `It's ${WW.room.formatTime(mins)}. This can wait until tomorrow.`,
        })[phase]
      : 'Click the front door to sign in.';
    hint.hidden = !open;
    listNote.textContent = open
      ? 'Everywhere you can go from here.'
      : 'Sign in at the front door first.';

    // During quiet hours the room says its piece instead of asking for a
    // check-in. Nothing is blocked — every destination still works.
    const note = document.querySelector('[data-room-note]');
    if (note) {
      note.hidden = !(open && phase === 'quiet');
      if (!note.hidden) {
        const q = WW.room.quietHours();
        note.querySelector('[data-note-text]').innerHTML =
          `<b>Your quiet hours started at ${WW.room.formatTime(q.from)}.</b>
           Nothing here is closed — everything still works if you need it.
           We just stopped asking.`;
      }
    }

    if (open && o.greet && phase !== 'quiet') {
      // First run goes to setup, not straight into the daily check-in.
      let onboarded = false;
      try { onboarded = localStorage.getItem('ww.onboarded') === '1'; } catch (e) {}
      if (!onboarded) {
        bubble.querySelector('[data-bubble-title]').textContent = "First time here — shall we set up?";
        bubble.querySelector('[data-bubble-text]').textContent =
          'Five questions, once. It starts with what your employer can and cannot see.';
        const go = bubble.querySelector('[data-bubble-go]');
        go.setAttribute('href', 'onboarding.html');
        go.textContent = 'Set up';
      }
      const delay = prefersReducedMotion() ? 0 : 1100;
      window.setTimeout(() => bubble.classList.add('is-in'), delay);
    }
  }

  /* ------------------------------------------------------------ Sign in */

  function openSignin() {
    signin.hidden = false;
    signin.querySelector('[data-auth-step="choose"]').hidden = false;
    signin.querySelector('[data-auth-step="working"]').hidden = true;
    signin.querySelector('.acct')?.focus();
  }

  function closeSignin() { signin.hidden = true; }

  function doSignIn(d) {
    user = {
      name: d.name, email: d.email, role: d.role,
      initials: d.initials, plane: d.plane,
    };
    try { localStorage.setItem(KEY, JSON.stringify(user)); } catch (e) { /* ignore */ }
    signedIn = true;

    signin.querySelector('[data-auth-step="choose"]').hidden = true;
    signin.querySelector('[data-auth-step="working"]').hidden = false;

    const wait = prefersReducedMotion() ? 120 : 700;
    window.setTimeout(() => {
      closeSignin();
      // Re-render so the meeting room unlocks for an HR account.
      roomEl.querySelector('svg')?.remove();
      renderRoom();
      renderAccount();
      setOpen(true, { greet: true });
      roomEl.querySelector('.spot')?.focus();
    }, wait);
  }

  /* -------------------------------------------------------------- Wiring */

  renderRoom();
  renderAccount();
  hydrate();
  setOpen(signedIn, { greet: false });

  WW.room.wireRoom(roomEl, { locked: () => !signedIn });

  roomEl.addEventListener('ww:frontdoor', () => {
    if (signedIn) return;
    openSignin();
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-list-signin]')) openSignin();
  });

  roomEl.addEventListener('ww:roomlocked', () => {
    caption.textContent =
      'That room holds group data for eight or more people. Your account cannot open it.';
  });

  signin.addEventListener('click', (e) => {
    if (e.target === signin || e.target.closest('[data-signin-close]')) closeSignin();
    const acct = e.target.closest('[data-account]');
    if (acct) doSignIn(acct.dataset);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !signin.hidden) closeSignin();
  });

  document.querySelector('[data-bubble-close]')
    .addEventListener('click', () => bubble.classList.remove('is-in'));

  /* View switch: room or plain list. */
  function setView(want) {
    document.querySelectorAll('[data-view]').forEach((x) =>
      x.setAttribute('aria-pressed', String(x.dataset.view === want)));
    document.querySelectorAll('[data-view-panel]').forEach((p) =>
      p.classList.toggle('is-on', p.dataset.viewPanel === want));
  }

  document.querySelectorAll('[data-view]').forEach((b) => {
    b.addEventListener('click', () => setView(b.dataset.view));
  });

  /* On a phone the plan scales down until its labels are ~13px tall and the
     tap targets are far under 44px. The list is simply the better small-screen
     experience, so start there — the room stays one tap away. */
  if (window.matchMedia('(max-width: 760px)').matches) setView('list');

  /* Theme toggle + account menu, mirroring the app shell. */
  function paintTheme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark'
      || (!document.documentElement.hasAttribute('data-theme')
          && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
      b.innerHTML = icon(dark ? 'sun' : 'moonFill');
    });
    return dark;
  }
  paintTheme();

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-theme-toggle]')) {
      const dark = paintTheme();
      document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
      try { localStorage.setItem('ww.theme', dark ? 'light' : 'dark'); } catch (err) {}
      paintTheme();
      return;
    }
    if (e.target.closest('[data-sign-out]')) {
      try { localStorage.removeItem(KEY); } catch (err) {}
      location.reload();
      return;
    }
    const trigger = e.target.closest('[data-account-menu]');
    const menu = document.querySelector('.account__menu');
    if (!menu) return;
    if (trigger) {
      const open = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!open));
      menu.hidden = open;
    } else if (!e.target.closest('.account__menu')) {
      menu.hidden = true;
      document.querySelector('[data-account-menu]')?.setAttribute('aria-expanded', 'false');
    }
  });
});

})(window.WW);
