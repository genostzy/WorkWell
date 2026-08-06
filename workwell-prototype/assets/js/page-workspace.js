/* ==========================================================================
   Adaptive Workspace — page wiring
   The accessibility controls here are real: they write the same preferences
   every screen reads, so the effect is visible immediately.
   ========================================================================== */

(function (WW) {
'use strict';

WW.onReady(function () {
  const groups = [...document.querySelectorAll('[data-pref]')];

  // Reflect the stored value on load.
  groups.forEach((g) => {
    const current = WW.getPref(g.dataset.pref);
    g.querySelectorAll('[data-value]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.value === current)));
  });

  // The generic segmented handler in app.js already moves aria-pressed;
  // this listener is what makes the choice actually take effect.
  document.addEventListener('ww:select', (e) => {
    const group = e.target.closest('[data-pref]');
    if (!group) return;
    WW.setPref(group.dataset.pref, e.target.dataset.value);
  });

  const reset = document.querySelector('[data-reset-prefs]');
  if (reset) {
    reset.addEventListener('click', () => {
      WW.setPref('theme', 'system');
      WW.setPref('motion', 'system');
      WW.setPref('contrast', 'normal');
      WW.setPref('density', 'comfortable');
      groups.forEach((g) => {
        const current = WW.getPref(g.dataset.pref);
        g.querySelectorAll('[data-value]').forEach((b) =>
          b.setAttribute('aria-pressed', String(b.dataset.value === current)));
      });
    });
  }
});

})(window.WW);
