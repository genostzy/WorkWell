/* ==========================================================================
   Daily check-in — page wiring

   Pacing: none of the four steps auto-advance. All four are drags now, and
   people overshoot and correct; advancing on the first value they pass
   through would take the screen away mid-gesture. The word chips under each
   scale remain a one-tap path, so a hurried check-in is still four taps.
   ========================================================================== */

(function (WW) {
'use strict';

const ORDER = ['mood', 'energy', 'pressure', 'workload'];
const TITLE = { mood: 'Mood', energy: 'Energy', pressure: 'Pressure', workload: 'Workload' };

WW.onReady(function () {
  const answers = {};

  // Seed from the initial value each scale rendered with, so the summary is
  // complete even for steps the person skipped without touching.
  document.querySelectorAll('[data-scale]').forEach((el) => {
    const stage = el.querySelector('[role="slider"]');
    if (stage) answers[el.dataset.scale] = stage.getAttribute('aria-valuetext');
  });

  document.addEventListener('ww:scale', (e) => {
    answers[e.detail.name] = e.detail.label;
  });

  const summary = document.querySelector('[data-checkin-summary]');
  if (!summary) return;

  document.addEventListener('ww:flowstep', (e) => {
    if (e.detail.name !== 'done') return;
    summary.innerHTML = ORDER
      .filter((k) => answers[k])
      .map((k) => `<span class="chip">${TITLE[k]}: <b>${answers[k]}</b></span>`)
      .join('');
  });
});

})(window.WW);
