/* ==========================================================================
   HR — Leave
   Approve and decline requests. Employment data only.
   ========================================================================== */

(function (WW) {
'use strict';

WW.onReady(function () {
  const H = WW.hr;
  if (!H || document.body.dataset.blocked === 'true') return;

  const pending = document.querySelector('[data-leave-pending]');
  const all = document.querySelector('[data-leave-all]');
  const balances = document.querySelector('[data-leave-balances]');

  // Local copy so approve/decline is visible without a backend.
  const requests = H.LEAVE.map((l) => Object.assign({}, l));

  const chipFor = (s) => {
    const cls = s === 'Approved' ? ' chip--accent' : '';
    return `<span class="chip${cls}">${s}</span>`;
  };

  function renderPending() {
    const list = requests.filter((l) => l.status === 'Pending');
    if (!list.length) {
      pending.innerHTML = `
        <div class="card card--quiet">
          <div class="row" style="gap:var(--s-3);flex-wrap:nowrap">
            <span data-icon="check" data-size="19"></span>
            <p class="t-subtle" style="margin:0">Nothing waiting on you.</p>
          </div>
        </div>`;
      WW.hydrateIcons(pending);
      return;
    }

    pending.innerHTML = list.map((l) => {
      const p = H.byId(l.person);
      const left = p.leave.entitlement - p.leave.taken - p.leave.booked;
      return `
      <article class="insight">
        <div class="insight__icon"><span class="avatar avatar--sm">${p.initials}</span></div>
        <div class="insight__body">
          <h3 class="insight__title">${p.name} — ${l.type.toLowerCase()}, ${l.days} day${l.days === 1 ? '' : 's'}</h3>
          <p class="insight__text">${H.fmtRange(l.from, l.to)}${l.note ? ` · “${l.note}”` : ''}</p>
          <div class="insight__foot">
            <button class="btn btn--primary btn--sm" type="button"
                    data-decide="Approved" data-id="${l.id}">Approve</button>
            <button class="btn btn--secondary btn--sm" type="button"
                    data-decide="Declined" data-id="${l.id}">Decline</button>
            <span class="insight__meta">${left} days left of ${p.leave.entitlement} · ${p.team}</span>
          </div>
        </div>
      </article>`;
    }).join('');
    WW.hydrateIcons(pending);
  }

  function renderAll() {
    all.innerHTML = requests.map((l) => {
      const p = H.byId(l.person);
      return `<tr>
        <th scope="row" style="font-weight:600;color:var(--text)">${p.name}</th>
        <td>${l.type}</td>
        <td>${H.fmtRange(l.from, l.to)}</td>
        <td>${l.days}</td>
        <td>${chipFor(l.status)}</td>
      </tr>`;
    }).join('');
  }

  function renderBalances() {
    balances.innerHTML = H.PEOPLE.filter((p) => p.status === 'Active').map((p) => {
      const used = p.leave.taken + p.leave.booked;
      const pct = Math.round((used / p.leave.entitlement) * 100);
      return `
        <div>
          <div class="row row--between">
            <span style="font-size:var(--fs-sm);font-weight:600">${p.name}</span>
            <span class="t-subtle t-num">${used} / ${p.leave.entitlement}</span>
          </div>
          <div class="meter__track mt-2">
            <div class="meter__fill" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-decide]');
    if (!btn) return;
    const req = requests.find((l) => l.id === btn.dataset.id);
    if (!req) return;
    req.status = btn.dataset.decide;
    // Approving commits the days against the person's balance.
    if (req.status === 'Approved') H.byId(req.person).leave.booked += req.days;
    renderPending(); renderAll(); renderBalances();
  });

  renderPending(); renderAll(); renderBalances();
});

})(window.WW);
