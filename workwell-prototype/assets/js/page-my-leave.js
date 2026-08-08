/* ==========================================================================
   Employee — My leave
   Reads work-data.js: the employee's OWN record only, never the directory.
   ========================================================================== */

(function (WW) {
'use strict';

WW.onReady(function () {
  const W = WW.work;
  if (!W || document.body.dataset.blocked === 'true') return;
  const me = W.ME;

  document.querySelector('[data-leave-type]').innerHTML =
    W.LEAVE_TYPES.map((t) => `<option>${t}</option>`).join('');

  document.querySelector('[data-my-leave]').innerHTML = W.MY_LEAVE.length
    ? W.MY_LEAVE.map((l) => `
        <tr>
          <th scope="row" style="font-weight:600;color:var(--text)">${l.type}</th>
          <td>${W.fmtRange(l.from, l.to)}</td>
          <td>${l.days}</td>
          <td><span class="chip${l.status === 'Approved' ? ' chip--accent' : ''}">${l.status}</span></td>
        </tr>`).join('')
    : '<tr><td colspan="4" class="t-subtle">Nothing booked yet.</td></tr>';

  const used = me.leave.taken + me.leave.booked;
  const left = me.leave.entitlement - used;
  document.querySelector('[data-leave-left]').textContent = left;
  document.querySelector('[data-leave-of]').textContent =
    `days left of ${me.leave.entitlement}`;
  document.querySelector('[data-leave-bar]').style.width =
    `${Math.round((used / me.leave.entitlement) * 100)}%`;
  document.querySelector('[data-leave-split]').innerHTML =
    `<span>${me.leave.taken} taken · ${me.leave.booked} booked</span><span>${left} left</span>`;
});

})(window.WW);
