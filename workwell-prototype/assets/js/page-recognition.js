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

})(window.WW);
