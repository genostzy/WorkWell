/* ==========================================================================
   Adaptive Health Nudges — page wiring
   ========================================================================== */

(function (WW) {
'use strict';

WW.onReady(function () {
  const host = document.querySelector('[data-nudge-list]');
  if (!host) return;

  host.className = 'stack stack--tight';
  host.innerHTML = WW.privateData.NUDGES.map((n) => `
    <div class="card card--quiet">
      <label class="toggle">
        <span class="toggle__text row" style="gap:var(--s-3);flex-wrap:nowrap;align-items:flex-start">
          <span class="nudge__icon" style="width:34px;height:34px">
            <span data-icon="${n.icon}" data-size="17"></span></span>
          <span>
            <span class="toggle__title">${n.title}</span>
            <span class="toggle__desc">${n.text}</span>
          </span>
        </span>
        <button class="switch" type="button" role="switch"
                aria-checked="${n.enabled}" aria-label="${n.title}"></button>
      </label>
    </div>`).join('');

  WW.hydrateIcons(host);
});

})(window.WW);
