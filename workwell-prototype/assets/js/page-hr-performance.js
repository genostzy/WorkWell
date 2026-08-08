/* ==========================================================================
   HR — Performance
   Review cycle status and goals. Never reads wellbeing.
   ========================================================================== */

(function (WW) {
'use strict';

WW.onReady(function () {
  const H = WW.hr;
  if (!H || document.body.dataset.blocked === 'true') return;

  const c = H.REVIEW_CYCLE;
  document.querySelector('[data-cycle-line]').textContent =
    `${c.name} — open ${H.fmtDate(c.opens)} to ${H.fmtDate(c.closes)}.`;

  const done = (r) => r.self === 'Submitted' && r.manager === 'Submitted';
  const started = (r) => r.self !== 'Not started' || r.manager !== 'Not started';

  document.querySelector('[data-review-summary]').innerHTML = [
    { label: 'Complete', value: H.REVIEWS.filter(done).length, note: 'both sides submitted' },
    { label: 'In progress', value: H.REVIEWS.filter((r) => started(r) && !done(r)).length, note: 'partly done' },
    { label: 'Not started', value: H.REVIEWS.filter((r) => !started(r)).length, note: 'nothing submitted' },
  ].map((t) => `
    <div class="card">
      <div class="stat">
        <span class="stat__label">${t.label}</span>
        <span class="stat__value t-num">${t.value}</span>
        <span class="stat__delta">${t.note}</span>
      </div>
    </div>`).join('');

  // Neutral chips throughout — a status is not a verdict on the person.
  const chip = (s) => `<span class="chip${s === 'Submitted' ? ' chip--accent' : ''}">${s}</span>`;

  document.querySelector('[data-review-rows]').innerHTML = H.REVIEWS.map((r) => {
    const p = H.byId(r.person);
    return `<tr>
      <th scope="row" style="font-weight:600;color:var(--text)">${p.name}
        <span class="t-subtle" style="display:block;font-weight:500">${p.title}</span></th>
      <td>${chip(r.self)}</td>
      <td>${chip(r.manager)}</td>
      <td>${H.fmtDate(r.due)}</td>
    </tr>`;
  }).join('');

  document.querySelector('[data-goals]').innerHTML = H.GOALS.map((g) => `
    <div>
      <div class="row row--between">
        <span style="font-size:var(--fs-sm);font-weight:600">${g.title}</span>
        <span class="t-subtle">${g.due} · ${g.progress}%</span>
      </div>
      <div class="meter__track mt-2">
        <div class="meter__fill" style="width:${g.progress}%"></div>
      </div>
    </div>`).join('');
});

})(window.WW);
