/* ==========================================================================
   HR — Directory
   Employment fields only. Nothing here reads the private plane.
   ========================================================================== */

(function (WW) {
'use strict';

WW.onReady(function () {
  const H = WW.hr;
  if (!H || document.body.dataset.blocked === 'true') return;

  const rows = document.querySelector('[data-people-rows]');
  const search = document.querySelector('[data-people-search]');
  const dept = document.querySelector('[data-people-dept]');
  const count = document.querySelector('[data-people-count]');
  const status = document.querySelector('[data-people-status]');
  const empty = document.querySelector('[data-people-empty]');

  /* Headline counts */
  const s = H.hrSummary();
  document.querySelector('[data-hr-summary]').innerHTML = [
    { label: 'Headcount', value: s.headcount, note: 'active employees' },
    { label: 'Onboarding', value: s.onboarding, note: 'in their first weeks' },
    { label: 'Leave to approve', value: s.pendingLeave, note: 'awaiting you' },
    { label: 'Reviews outstanding', value: s.reviewsOutstanding, note: 'this cycle' },
  ].map((t) => `
    <div class="card">
      <div class="stat">
        <span class="stat__label">${t.label}</span>
        <span class="stat__value t-num">${t.value}</span>
        <span class="stat__delta">${t.note}</span>
      </div>
    </div>`).join('');

  /* Department filter, built from the data so it cannot drift */
  const depts = [...new Set(H.PEOPLE.map((p) => p.dept))].sort();
  dept.innerHTML = '<option value="all">All departments</option>'
    + depts.map((d) => `<option value="${d}">${d}</option>`).join('');

  function render() {
    const q = (search.value || '').trim().toLowerCase();
    const d = dept.value;
    const list = H.PEOPLE.filter((p) => {
      if (d !== 'all' && p.dept !== d) return false;
      if (!q) return true;
      return [p.name, p.title, p.team, p.dept].join(' ').toLowerCase().includes(q);
    });

    rows.innerHTML = list.map((p) => `
      <tr>
        <th scope="row" style="font-weight:600;color:var(--text)">
          <span class="row" style="gap:var(--s-3);flex-wrap:nowrap">
            <span class="avatar avatar--sm">${p.initials}</span>
            <span>
              <a href="my-profile.html?id=${p.id}" style="font-weight:700">${p.name}</a>
              <span class="t-subtle" style="display:block;font-weight:500">${p.email}</span>
            </span>
          </span>
        </th>
        <td>${p.title}</td>
        <td>${p.team}</td>
        <td>${p.manager}</td>
        <td>${H.fmtDate(p.started)}</td>
        <td><span class="chip${p.status === 'Onboarding' ? ' chip--accent' : ''}">${p.status}</span></td>
      </tr>`).join('');

    count.textContent = `${list.length} of ${H.PEOPLE.length}`;
    status.textContent = `${list.length} people shown.`;
    empty.hidden = list.length > 0;
    rows.closest('.card').hidden = list.length === 0;
  }

  search.addEventListener('input', render);
  dept.addEventListener('change', render);
  render();
});

})(window.WW);
