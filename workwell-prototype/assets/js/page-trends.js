/* ==========================================================================
   Personal Trend Reflection — page wiring
   ========================================================================== */

(function (WW) {
'use strict';

const D = WW.data;
const P = D.PERSONAL;

function renderInsights() {
  const host = document.querySelector('[data-insights]');
  if (!host) return;
  host.innerHTML = D.INSIGHTS.map((i) => `
    <article class="insight">
      <div class="insight__icon"><span data-icon="${i.icon}" data-size="17"></span></div>
      <div class="insight__body">
        <h3 class="insight__title">${i.title}</h3>
        <p class="insight__text">${i.text}</p>
        <div class="insight__foot">
          <a class="btn btn--quiet btn--sm" href="${i.href}">${i.action}</a>
          <span class="insight__meta">${i.meta}</span>
        </div>
      </div>
    </article>`).join('');
}

/* Self-reported signals render as labelled bars, not as a composite index.
   Deliberately never summed into one number — that would be a score. */
function renderSelfReport() {
  const host = document.querySelector('[data-selfreport]');
  if (!host) return;

  const words = {
    mood:     ['', 'Low', 'Not great', 'OK', 'Good', 'Great'],
    energy:   ['', 'Empty', 'Low', 'Steady', 'Good', 'High'],
    stress:   ['', 'Calm', 'Settled', 'Noticeable', 'High', 'Very high'],
    workload: ['', 'Light', 'Manageable', 'About right', 'Heavy', 'Too much'],
  };

  host.innerHTML = ['mood', 'energy', 'stress', 'workload'].map((k) => {
    const s = P[k];
    const now = s.values[s.values.length - 1];
    const then = s.values[0];
    const pct = (now / 5) * 100;
    return `
      <div>
        <div class="row row--between">
          <span style="font-size:var(--fs-sm);font-weight:600">${s.label}</span>
          <span class="t-subtle" style="font-weight:700">${words[k][now]}
            <span style="font-weight:500">· was ${words[k][then].toLowerCase()} 12 weeks ago</span></span>
        </div>
        <div class="meter__track mt-2">
          <div class="meter__fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

function renderCharts() {
  const chartFor = {
    workingHours: { label: 'Working hours', unit: 'h' },
    afterHours:   { label: 'Messages after 18:30', unit: '' },
    meetingLoad:  { label: 'Meeting hours', unit: 'h' },
  };

  Object.keys(chartFor).forEach((key) => {
    const host = document.querySelector(`[data-chart="${key}"]`);
    if (!host) return;
    const s = P[key];
    WW.charts.line(host, {
      values: s.values,
      labels: P.weeks,
      unit: chartFor[key].unit,
      label: chartFor[key].label,
      band: s.band,
      baseline: s.baseline,
      height: key === 'workingHours' ? 240 : 200,
    });
  });

  document.querySelectorAll('[data-spark]').forEach((el) => {
    WW.charts.spark(el, P[el.dataset.spark].values, { height: 34 });
  });
}

WW.onReady(function () {
  renderInsights();
  renderSelfReport();
  renderCharts();
  WW.hydrateIcons();
});

})(window.WW);
