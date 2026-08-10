/* ==========================================================================
   Recognition & Social Connection — page wiring
   ========================================================================== */

(function (WW) {
'use strict';

WW.onReady(function () {
  const host = document.querySelector('[data-recognition-feed]');
  if (!host) return;

  host.className = 'feed';
  host.innerHTML = WW.privateData.RECOGNITION.map((r) => `
    <article class="feed__item">
      <div class="avatar">${r.initials}</div>
      <div class="grow">
        <div class="row row--between">
          <span class="feed__name">${r.from}</span>
          <span class="feed__time">${r.time}</span>
        </div>
        <p class="feed__text">${r.text}</p>
        <div class="row mt-3">
          <button class="btn btn--ghost btn--sm" type="button">
            <span data-icon="heart" data-size="14"></span> Say thanks</button>
          ${r.kind === 'coffee'
            ? '<button class="btn btn--quiet btn--sm" type="button">Find a time</button>'
            : ''}
        </div>
      </div>
    </article>`).join('');

  WW.hydrateIcons(host);
});

WW.onReady(function () {
  if (document.body.dataset.blocked === 'true') return;

  /* Appreciation: both buttons resolve the same composer, so the row goes
     together and the form it belongs to is disabled behind it. */
  const actions = document.querySelector('[data-appreciate-actions]');
  actions?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-appreciate]');
    if (!btn) return;
    disableFieldsIn(actions.closest('.card'));
    WW.confirmAction(actions, btn.dataset.appreciate === 'coffee'
      ? 'Coffee offered. They can decline without a word to anyone.'
      : 'Appreciation sent.');
  });

  const priv = document.querySelector('[data-send-private]');
  priv?.addEventListener('click', () => {
    disableFieldsIn(priv.closest('.card'));
    WW.confirmAction(priv, 'Sent privately. Your manager is not copied.');
  });
});

/** Stop the composer accepting edits once its message has gone. */
function disableFieldsIn(card) {
  card?.querySelectorAll('input, select, textarea, button')
    .forEach((el) => { el.disabled = true; });
}

})(window.WW);
