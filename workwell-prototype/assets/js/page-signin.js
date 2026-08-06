/* ==========================================================================
   WorkWell — Sign-in

   Demonstration only. Nothing here authenticates anything: no credentials are
   read, transmitted, or stored, and the password field's value is discarded.
   Signing in records only a display name and role so the app chrome can show
   who is signed in, and routes to that role's landing screen.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

const icon = WW.icon;
const KEY = 'ww.user';

/* Applies the stored theme/motion/contrast prefs before paint, matching the
   app shell, so signing out doesn't flash a different theme. */
(function applyPrefs() {
  const map = {
    'ww.theme': 'data-theme',
    'ww.motion': 'data-motion',
    'ww.contrast': 'data-contrast',
    'ww.density': 'data-density',
  };
  Object.keys(map).forEach((k) => {
    let v = null;
    try { v = localStorage.getItem(k); } catch (e) { /* private browsing */ }
    if (v && v !== 'system' && !(k === 'ww.contrast' && v === 'normal')) {
      document.documentElement.setAttribute(map[k], v);
    }
  });
})();

function hydrate() {
  document.querySelectorAll('[data-icon-slot]').forEach((el) => {
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.iconSlot, { size: 18 }));
    el.removeAttribute('data-icon-slot');
  });
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const svg = icon(el.dataset.icon, { size: Number(el.dataset.size) || 20 });
    if (svg) el.outerHTML = svg;
  });
}

function step(name) {
  document.querySelectorAll('[data-auth-step]').forEach((s) => {
    s.hidden = s.dataset.authStep !== name;
  });
  const focusable = document.querySelector(`[data-auth-step="${name}"] input, [data-auth-step="${name}"] button`);
  if (focusable) focusable.focus({ preventScroll: true });
}

/** Stores display identity only — never a credential. */
function signIn(user, destination) {
  try { localStorage.setItem(KEY, JSON.stringify(user)); } catch (e) { /* ignore */ }
  step('working');
  window.setTimeout(() => { location.href = destination; }, 850);
}

document.addEventListener('DOMContentLoaded', function () {
  hydrate();

  let pending = {
    name: 'Alex Rivera',
    email: 'alex.rivera@northwind.example',
    role: 'Employee',
    initials: 'AR',
    go: 'trends.html',
  };

  // Account chooser
  document.querySelectorAll('[data-account]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = btn.dataset;
      signIn({ name: d.name, email: d.email, role: d.role, initials: d.initials }, d.go);
    });
  });

  // Step navigation
  document.querySelectorAll('[data-auth-goto]').forEach((b) => {
    b.addEventListener('click', () => {
      const target = b.dataset.authGoto;
      if (target === 'password') {
        const label = document.querySelector('[data-auth-email]');
        if (label) label.textContent = 'Enter your work email and password.';
        const email = document.getElementById('email');
        if (email) email.value = '';
      }
      step(target);
    });
  });

  // Show / hide password
  const pw = document.getElementById('password');
  const toggle = document.querySelector('[data-toggle-pw]');
  if (pw && toggle) {
    toggle.addEventListener('click', () => {
      const shown = pw.type === 'text';
      pw.type = shown ? 'password' : 'text';
      toggle.setAttribute('aria-pressed', String(!shown));
      toggle.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
      toggle.innerHTML = icon(shown ? 'eye' : 'eyeOff', { size: 17 });
    });
  }

  // Sign in. The password value is never read.
  const form = document.querySelector('[data-auth-form]');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = (document.getElementById('email').value || '').trim();
      const local = email.split('@')[0] || 'Alex Rivera';
      const name = local
        .split(/[._-]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ') || 'Alex Rivera';
      const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

      // An HR-shaped address lands on the organisation view, mirroring how a
      // real deployment would route by the account's role.
      const isHr = /^(hr|people|dee)/i.test(local);

      signIn({
        name,
        email: email || pending.email,
        role: isHr ? 'People Partner' : 'Employee',
        initials: initials || 'AR',
      }, isHr ? 'org-diagnostics.html' : 'trends.html');
    });
  }

  const sso = document.querySelector('[data-auth-sso]');
  if (sso) sso.addEventListener('click', () => signIn(pending, pending.go));
});

})(window.WW);
