/* ==========================================================================
   Boundary Assistant — page wiring

   Only the two release actions. The quiet-hours window itself is persisted
   by the inline script in boundary.html, since the office reads it.
   ========================================================================== */

(function (WW) {
'use strict';

WW.onReady(function () {
  if (document.body.dataset.blocked === 'true') return;

  /* One held message. Both choices resolve the nudge, so the whole action
     row is replaced — leaving "Send now anyway" live beside a spent
     "Schedule" would read as though the message were still waiting. */
  const holdActions = document.querySelector('[data-hold-actions]');
  holdActions?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-hold]');
    if (!btn) return;
    WW.confirmAction(holdActions, btn.dataset.hold === 'schedule'
      ? 'Held until 9:00 am.'
      : 'Sent.');
  });

  /* The whole queue. */
  const queueActions = document.querySelector('[data-queue-actions]');
  queueActions?.addEventListener('click', (e) => {
    if (!e.target.closest('[data-send-all]')) return;
    const list = document.querySelector('[data-queue-list]');
    if (list) {
      list.innerHTML =
        '<p class="t-subtle" style="font-size:var(--fs-sm)">Nothing queued.</p>';
    }
    WW.confirmAction(queueActions, 'All sent.');
  });
});

})(window.WW);
