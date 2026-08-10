/* ==========================================================================
   Component inventory — page wiring
   ========================================================================== */

(function (WW) {
'use strict';

const RAMP = ['--seq-100', '--seq-200', '--seq-300', '--seq-400',
              '--seq-500', '--seq-600', '--seq-700'];

/* Sample series for the chart demos.
   Invented for this page rather than read from private-data.js. This is
   documentation, reachable on any account, so it must not require the
   private plane — which refuses to populate for HR, and would put an
   employee's real mood data in the page for everyone else. */
const DEMO = {
  weeks: ['Mar 3', 'Mar 10', 'Mar 17', 'Mar 24', 'Mar 31', 'Apr 7',
          'Apr 14', 'Apr 21', 'Apr 28', 'May 5', 'May 12', 'May 19'],
  line: { values: [39, 41, 38, 40, 42, 41, 44, 43, 46, 47, 45, 49],
          baseline: 41, band: [37, 44] },
  spark: [4, 6, 3, 5, 8, 7, 9, 11, 14, 13, 17, 19],
};

function renderSwatches() {
  document.querySelectorAll('[data-swatches]').forEach((host) => {
    const cs = getComputedStyle(host);
    const rows = [{ name: 'accent', varName: '--accent' }]
      .concat(RAMP.map((v) => ({ name: v.replace('--seq-', 'ramp '), varName: v })));

    host.innerHTML = rows.map((r) => {
      const hex = cs.getPropertyValue(r.varName).trim();
      return `
        <div class="swatch">
          <div class="swatch__chip" style="background:var(${r.varName})"></div>
          <div class="swatch__meta">
            <div class="swatch__name">${r.name}</div>
            <div class="swatch__hex">${hex || '—'}</div>
          </div>
        </div>`;
    }).join('');
  });
}

function renderIconGrid() {
  const host = document.querySelector('[data-icon-grid]');
  if (!host) return;
  host.innerHTML = Object.keys(WW.ICONS).map((name) => `
    <div class="swatch" style="border:none">
      <div class="swatch__chip" style="display:grid;place-items:center;background:var(--surface-2);
           border-radius:var(--r-sm);color:var(--text-muted)">
        ${WW.icon(name, { size: 22 })}
      </div>
      <div class="swatch__meta" style="background:transparent;padding-left:0">
        <div class="swatch__hex">${name}</div>
      </div>
    </div>`).join('');
}

function renderDemoCharts() {
  const line = document.querySelector('[data-demo-chart="line"]');
  if (line) {
    WW.charts.line(line, {
      values: DEMO.line.values,
      labels: DEMO.weeks,
      unit: 'h',
      label: 'Working hours',
      band: DEMO.line.band,
      baseline: DEMO.line.baseline,
      height: 200,
    });
  }

  const bar = document.querySelector('[data-demo-chart="bars"]');
  if (bar) {
    WW.charts.bars(bar, {
      values: WW.data.HOURS_DISTRIBUTION.counts,
      labels: WW.data.HOURS_DISTRIBUTION.buckets,
      label: 'People',
      dimension: 'Hours per week',
      height: 200,
    });
  }

  const hb = document.querySelector('[data-demo-chart="hbars"]');
  if (hb) {
    WW.charts.hbars(hb, {
      label: 'Weekly hours', unit: 'h', max: 60,
      rows: [
        { name: 'Platform', n: 14, value: 44, locked: false },
        { name: 'Web', n: 12, value: 41, locked: false },
        { name: 'Mobile', n: 9, value: 39, locked: false },
        { name: 'Quality', n: 7, value: 38, locked: true },
      ],
    });
  }

  const ht = document.querySelector('[data-demo-chart="heat"]');
  if (ht) {
    WW.charts.heat(ht, {
      rows: WW.data.WORKLOAD_PATTERN.rows.slice(0, 3),
      cols: WW.data.WORKLOAD_PATTERN.cols,
      values: WW.data.WORKLOAD_PATTERN.values.slice(0, 3),
    });
  }

  const sp = document.querySelector('[data-demo-chart="spark"]');
  if (sp) WW.charts.spark(sp, DEMO.spark, { height: 40 });
}

WW.onReady(function () {
  renderSwatches();
  renderIconGrid();
  renderDemoCharts();
  WW.hydrateIcons();

  // Swatch hexes are read from computed styles, so they must be re-read
  // whenever the theme changes.
  document.addEventListener('ww:pref', (e) => {
    if (e.detail.name === 'theme' || e.detail.name === 'contrast') renderSwatches();
  });
});

})(window.WW);
