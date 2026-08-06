/* ==========================================================================
   Structural Load Diagnostics — page wiring

   The suppression rule is enforced here, once, at the point where cohorts are
   selected: every renderer downstream receives the filtered list and must not
   read metric fields from a locked cohort. Re-locking is not a display effect
   — it re-runs on every filter change against the filtered headcount.
   ========================================================================== */

(function (WW) {
'use strict';

const D = WW.data;
const MIN = D.MIN_GROUP;

const state = { range: '90d', dept: 'all' };
/* null until the first render: the note means "your change hid more", so it
   must not fire on initial load when nothing has been changed yet. */
let lastSuppressed = null;

const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

/* ------------------------------------------------------------- Roll-up */

function renderRollup(roll, cohorts) {
  const host = document.querySelector('[data-rollup]');
  if (!host) return;

  if (!roll) { host.innerHTML = ''; return; }

  const tiles = [
    { label: 'People represented', value: roll.people, unit: '', note: `across ${roll.cohorts} groups` },
    { label: 'Average weekly hours', value: roll.hours, unit: 'h', note: 'per person' },
    { label: 'Average meeting load', value: roll.meetings, unit: 'h', note: 'per person per week' },
    { label: 'Leave taken', value: roll.ptoUptake, unit: '%', note: 'of accrued leave' },
  ];

  host.innerHTML = tiles.map((t) => `
    <div class="card">
      <div class="stat">
        <span class="stat__label">${t.label}</span>
        <span class="stat__value t-num">${t.value}${t.unit ? `<span class="stat__unit">${t.unit}</span>` : ''}</span>
        <span class="stat__delta">${t.note}</span>
      </div>
    </div>`).join('');
}

/* -------------------------------------------------------------- Charts */

function renderCharts(cohorts) {
  const open = cohorts.filter((c) => !c.locked);

  const bar = (sel, key, label, unit, max) => {
    const host = document.querySelector(`[data-chart="${sel}"]`);
    if (!host) return;
    WW.charts.hbars(host, {
      label, unit, max,
      // Locked cohorts are passed through so the suppression is visible in
      // place, rather than the group silently vanishing from the ranking.
      rows: cohorts.map((c) => ({
        name: c.name, n: c.n, locked: c.locked, value: c[key],
      })),
    });
  };

  bar('hours',      'hours',      'Weekly hours',   'h',  60);
  bar('meetings',   'meetings',   'Meeting hours',  'h',  25);
  bar('afterHours', 'afterHours', 'After-hours',    '%',  100);
  bar('pto',        'ptoUptake',  'Leave taken',    '%',  100);

  const dist = document.querySelector('[data-chart="distribution"]');
  if (dist) {
    WW.charts.bars(dist, {
      values: D.HOURS_DISTRIBUTION.counts,
      labels: D.HOURS_DISTRIBUTION.buckets,
      label: 'People',
      dimension: 'Hours per week',
      height: 220,
    });
  }

  const heat = document.querySelector('[data-chart="workload"]');
  if (heat) {
    // Only groups that cleared the threshold may appear as rows.
    const names = open.map((c) => c.name);
    const keep = D.WORKLOAD_PATTERN.rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => names.some((n) => n.indexOf(r.split(' ')[0]) === 0 || r.indexOf(n) === 0));

    if (!keep.length) {
      heat.innerHTML = `
        <div class="locked">
          <div class="locked__icon"><span data-icon="lock" data-size="19"></span></div>
          <div class="locked__title">Not shown</div>
          <p class="locked__text">No group here has 8 or more people contributing.</p>
        </div>`;
      WW.hydrateIcons(heat);
      return;
    }

    WW.charts.heat(heat, {
      rows: keep.map(({ r }) => r),
      cols: D.WORKLOAD_PATTERN.cols,
      values: keep.map(({ i }) => D.WORKLOAD_PATTERN.values[i]),
    });
  }
}

/* ------------------------------------------------------ Locked group grid */

function renderLocked(cohorts) {
  const host = document.querySelector('[data-locked-grid]');
  if (!host) return;

  const locked = cohorts.filter((c) => c.locked);

  if (!locked.length) {
    host.innerHTML = `
      <div class="card card--quiet" style="grid-column:1/-1">
        <div class="row" style="gap:var(--s-3);flex-wrap:nowrap">
          <span data-icon="check" data-size="19"></span>
          <p class="t-subtle" style="margin:0">Every group here has at least ${MIN} people
            contributing. Nothing is suppressed.</p>
        </div>
      </div>`;
    WW.hydrateIcons(host);
    return;
  }

  host.innerHTML = locked.map((c) => `
    <div class="locked">
      <div class="locked__icon"><span data-icon="lock" data-size="19"></span></div>
      <div class="locked__title">${c.name}</div>
      <p class="locked__text">Not shown — fewer than ${MIN} people in this group,
        to protect anonymity.</p>
      <span class="tip">
        <span class="chip" tabindex="0" role="button" aria-describedby="tip-${c.id}">
          <span data-icon="info" data-size="13"></span> Why?
        </span>
        <span class="tip__bubble" id="tip-${c.id}" role="tooltip">
          ${plural(c.n, 'person', 'people')} contributing in this window. Below ${MIN}, a
          group average can be worked backwards toward an individual.
        </span>
      </span>
    </div>`).join('');

  WW.hydrateIcons(host);
}

/* ----------------------------------------------------- Structural prompts */

function renderPrompts() {
  const host = document.querySelector('[data-org-prompts]');
  if (!host) return;
  host.innerHTML = D.ORG_PROMPTS.map((p) => `
    <article class="insight">
      <div class="insight__icon"><span data-icon="${p.icon}" data-size="17"></span></div>
      <div class="insight__body">
        <h3 class="insight__title">${p.title}</h3>
        <p class="insight__text">${p.text}</p>
        <div class="insight__foot">
          <span class="chip chip--accent">${p.action}</span>
          <span class="insight__meta">${p.meta}</span>
        </div>
      </div>
    </article>`).join('');
  WW.hydrateIcons(host);
}

/* ------------------------------------------------------------- Filtering */

function apply() {
  const cohorts = D.orgCohorts(state.range, state.dept);
  const roll = D.orgRollup(cohorts);
  const suppressed = cohorts.filter((c) => c.locked).length;

  // Scope chips
  const scope = document.querySelector('[data-scope-chip]');
  if (scope) {
    scope.innerHTML = roll
      ? `${D.RANGE_LABEL[state.range]} · ${plural(roll.people, 'person', 'people')} · ${plural(roll.cohorts, 'group')} shown`
      : `${D.RANGE_LABEL[state.range]} · nothing can be shown`;
  }

  const supChip = document.querySelector('[data-suppressed-chip]');
  if (supChip) {
    supChip.hidden = suppressed === 0;
    supChip.innerHTML = `${WW.icon('lock', { size: 13 })} ${plural(suppressed, 'group')} hidden`;
  }

  // Announce the change, including when suppression grows.
  const status = document.querySelector('[data-filter-status]');
  if (status) {
    status.textContent = roll
      ? `${D.RANGE_LABEL[state.range]}. ${plural(roll.cohorts, 'group')} shown, covering ${plural(roll.people, 'person', 'people')}. ${plural(suppressed, 'group')} hidden for having fewer than ${MIN} people.`
      : `${D.RANGE_LABEL[state.range]}. No groups can be shown — every group has fewer than ${MIN} people.`;
  }

  const note = document.querySelector('[data-relock-note]');
  if (note) note.hidden = lastSuppressed === null || suppressed <= lastSuppressed;
  lastSuppressed = suppressed;

  // If nothing survives the threshold, the whole populated view is wrong to
  // show — switch to the all-suppressed state rather than render empty charts.
  const group = document.querySelector('[data-state-group]');
  const populated = group.querySelector('[data-state-panel="populated"]');
  const allLocked = group.querySelector('[data-state-panel="suppressed"]');
  const showingPopulated = populated.classList.contains('is-active')
    || allLocked.classList.contains('is-active');

  if (showingPopulated) {
    populated.classList.toggle('is-active', !!roll);
    allLocked.classList.toggle('is-active', !roll);
  }

  // Always re-render, including when nothing survives the threshold. Leaving
  // the previous filter's figures sitting in the hidden populated panel would
  // let the state switcher reveal numbers that the current filter forbids.
  renderRollup(roll, cohorts);
  renderLocked(cohorts);

  if (roll) {
    renderCharts(cohorts);
  } else {
    document.querySelectorAll('[data-chart]').forEach((el) => {
      el.innerHTML = `
        <div class="locked">
          <div class="locked__icon"><span data-icon="lock" data-size="19"></span></div>
          <div class="locked__title">Not shown</div>
          <p class="locked__text">No group here has ${MIN} or more people contributing.</p>
        </div>`;
      WW.hydrateIcons(el);
    });
  }
}

/* ------------------------------------------------------------------ Init */

WW.onReady(function () {
  document.querySelectorAll('[data-filter]').forEach((sel) => {
    sel.addEventListener('change', () => {
      state[sel.dataset.filter] = sel.value;
      apply();
    });
  });

  document.querySelectorAll('[data-reset-filters]').forEach((b) => {
    b.addEventListener('click', () => {
      state.range = '90d';
      state.dept = 'all';
      lastSuppressed = null;
      document.querySelector('[data-filter="range"]').value = '90d';
      document.querySelector('[data-filter="dept"]').value = 'all';
      apply();
    });
  });

  renderPrompts();
  apply();
});

})(window.WW);
