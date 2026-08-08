/* ==========================================================================
   Employee — My profile
   Reads work-data.js: the employment record HR holds, shown back to the
   person it describes. Not the directory, and not the private plane.
   ========================================================================== */

(function (WW) {
'use strict';

WW.onReady(function () {
  const W = WW.work;
  if (!W || document.body.dataset.blocked === 'true') return;
  const me = W.ME;

  const fields = [
    ['Name', me.name], ['Job title', me.title], ['Department', me.dept],
    ['Team', me.team], ['Manager', me.manager], ['Contract', me.type],
    ['Location', me.location], ['Started', W.fmtDate(me.started)],
    ['Work email', me.email], ['Status', me.status],
  ];

  document.querySelector('[data-profile-rows]').innerHTML = fields.map(([k, v]) => `
    <tr>
      <th scope="row" style="font-weight:600;color:var(--text-muted);width:38%">${k}</th>
      <td style="font-weight:600;color:var(--text)">${v}</td>
    </tr>`).join('');

  document.querySelector('[data-documents]').innerHTML = W.MY_DOCUMENTS.map((d) => `
    <tr>
      <th scope="row" style="font-weight:600;color:var(--text)">${d.name}</th>
      <td><span class="chip">${d.kind}</span></td>
      <td>${W.fmtDate(d.date)}</td>
      <td><button class="btn btn--ghost btn--sm" type="button">Download</button></td>
    </tr>`).join('');
});

})(window.WW);
