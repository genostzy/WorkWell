/* ==========================================================================
   WorkWell — Multi-step flow engine
   Drives both the onboarding and the daily check-in. Steps declare
   themselves in markup; this only moves between them and keeps the progress
   indicator and focus honest.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

function initFlow(root) {
  const steps = [...root.querySelectorAll('[data-step]')];
  if (!steps.length) return;

  const progress = root.querySelector('[data-flow-progress]');
  const counter = root.querySelector('[data-flow-counter]');
  // The final confirmation is not a "step" the user works through.
  const counted = steps.filter((s) => s.dataset.step !== 'done').length;

  let at = 0;

  function paint() {
    steps.forEach((s, i) => s.hidden = i !== at);

    if (progress) {
      progress.innerHTML = Array.from({ length: counted }, (_, i) =>
        `<span class="stepper__dot" data-done="${i <= at}"></span>`).join('');
    }
    if (counter) {
      counter.textContent = at < counted
        ? `Step ${at + 1} of ${counted}`
        : 'All done';
    }

    // Move focus to the new step heading so the change is announced.
    const h = steps[at].querySelector('h2, h3, [tabindex="-1"]');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
    root.scrollIntoView({ block: 'nearest' });

    root.dispatchEvent(new CustomEvent('ww:flowstep', {
      bubbles: true,
      detail: { index: at, name: steps[at].dataset.step },
    }));
  }

  function go(delta) {
    const next = Math.min(steps.length - 1, Math.max(0, at + delta));
    if (next === at) return;
    at = next;
    paint();
  }

  function jump(name) {
    const i = steps.findIndex((s) => s.dataset.step === name);
    if (i >= 0) { at = i; paint(); }
  }

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) { e.preventDefault(); go(1); }
    else if (e.target.closest('[data-back]')) { e.preventDefault(); go(-1); }
    else {
      const j = e.target.closest('[data-jump]');
      if (j) { e.preventDefault(); jump(j.dataset.jump); }
    }
  });

  paint();
  return { go, jump, get index() { return at; } };
}

WW.initFlow = initFlow;

WW.onReady(function () {
  document.querySelectorAll('[data-flow]').forEach(initFlow);
});

})(window.WW);
