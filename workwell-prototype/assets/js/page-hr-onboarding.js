/* ==========================================================================
   HR — Onboarding
   New joiner checklists and policy acknowledgements.
   ========================================================================== */

(function (WW) {
'use strict';

WW.onReady(function () {
  const H = WW.hr;
  if (!H || document.body.dataset.blocked === 'true') return;

  const host = document.querySelector('[data-onboarding]');
  const state = H.ONBOARDING.map((o) => ({
    ...o, tasks: o.tasks.map((t) => ({ ...t })),
  }));

  function render() {
    host.innerHTML = state.map((o, oi) => {
      const p = H.byId(o.person);
      const done = o.tasks.filter((t) => t.done).length;
      const pct = Math.round((done / o.tasks.length) * 100);
      return `
      <div class="card">
        <div class="card__head">
          <div class="row" style="gap:var(--s-3);flex-wrap:nowrap">
            <span class="avatar">${p.initials}</span>
            <div>
              <div class="card__title">${p.name}</div>
              <div class="card__sub">${p.title} · started ${H.fmtDate(o.started)} · buddy ${o.buddy}</div>
            </div>
          </div>
          <span class="chip chip--accent">${done} of ${o.tasks.length}</span>
        </div>

        <div class="meter mb-4">
          <div class="meter__track"><div class="meter__fill" style="width:${pct}%"></div></div>
        </div>

        <div class="stack stack--tight">
          ${o.tasks.map((t, ti) => `
            <label class="toggle" style="padding:var(--s-2) 0">
              <span class="toggle__text">
                <span class="toggle__title">${t.label}</span>
                <span class="toggle__desc">Owner: ${t.owner}</span>
              </span>
              <button class="switch" type="button" role="switch"
                      aria-checked="${t.done}" aria-label="${t.label}"
                      data-task="${oi}:${ti}"></button>
            </label>`).join('')}
        </div>
      </div>`;
    }).join('');
    WW.hydrateIcons(host);
  }

  // This listener is on `host`, so it runs while the click is still bubbling
  // toward the shell's document-level switch handler — aria-checked has not
  // flipped yet. Reading it here would assign the model its own current value
  // and nothing would move. Flip the model instead and let render() redraw.
  host.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-task]');
    if (!sw) return;
    const [oi, ti] = sw.dataset.task.split(':').map(Number);
    state[oi].tasks[ti].done = !state[oi].tasks[ti].done;
    render();
  });

  render();

  document.querySelector('[data-policies]').innerHTML = H.POLICIES.map((p) => `
    <div class="row row--between" style="gap:var(--s-3)">
      <span>
        <span style="font-size:var(--fs-sm);font-weight:600">${p.name}</span>
        <span class="t-subtle" style="display:block">Updated ${H.fmtDate(p.updated)}</span>
      </span>
      <span class="chip${p.ack ? ' chip--accent' : ''}">${p.ack ? 'Acknowledged' : 'Outstanding'}</span>
    </div>`).join('');
});

})(window.WW);
