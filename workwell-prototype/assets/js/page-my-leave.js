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

  wireRequest(W);
});

/* --------------------------------------------------------------- Request */

/**
 * Nothing is transmitted — the row is added locally so the screen is
 * consistent with what the person just did, and the wording says as much.
 */
function wireRequest(W) {
  const btn = document.querySelector('[data-leave-send]');
  if (!btn) return;

  const type = document.getElementById('lt');
  const from = document.getElementById('lf');
  const to = document.getElementById('lto');
  const err = document.createElement('p');
  err.className = 'field__hint mt-3';
  err.style.color = 'var(--danger-text, var(--text))';
  err.hidden = true;
  err.setAttribute('role', 'alert');
  btn.after(err);

  btn.addEventListener('click', () => {
    const problem = validate(type, from, to);
    if (problem) {
      err.textContent = problem.message;
      err.hidden = false;
      problem.field.setAttribute('aria-invalid', 'true');
      problem.field.focus();
      return;
    }

    [type, from, to].forEach((f) => f.removeAttribute('aria-invalid'));
    err.remove();

    const body = document.querySelector('[data-my-leave]');
    const empty = body.querySelector('td[colspan]');
    if (empty) empty.closest('tr').remove();

    const row = document.createElement('tr');
    row.className = 'settle';
    row.innerHTML = `
      <th scope="row" style="font-weight:600;color:var(--text)">${type.value}</th>
      <td>${W.fmtRange(from.value, to.value)}</td>
      <td>${days(from.value, to.value)}</td>
      <td><span class="chip">Pending</span></td>`;
    body.prepend(row);

    WW.confirmAction(btn, 'Request sent to your manager.');
  });
}

function validate(type, from, to) {
  if (!type.value) return { field: type, message: 'Choose a type of leave.' };
  if (!from.value) return { field: from, message: 'Choose a start date.' };
  if (!to.value) return { field: to, message: 'Choose an end date.' };
  if (to.value < from.value) {
    return { field: to, message: 'The end date is before the start date.' };
  }
  return null;
}

/** Inclusive day count. Calendar days, not working days — a prototype. */
function days(a, b) {
  const ms = new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00');
  return Math.round(ms / 86400000) + 1;
}

})(window.WW);
