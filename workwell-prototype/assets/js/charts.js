/* ==========================================================================
   WorkWell — Charts
   Hand-rolled SVG. Every chart here is single-series or a single-hue
   sequential ramp: the data's job is magnitude and change-over-time, never
   identity, so the categorical palette is deliberately never reached for.

   Mark spec: 2px lines, 8px markers, 4px rounded data-ends anchored to the
   baseline, a 2px surface ring on overlapping marks, recessive grid/axes,
   selective direct labels. Every chart ships a hover layer and a table view.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

const NS = 'http://www.w3.org/2000/svg';
const uid = (() => { let n = 0; return () => `ww${++n}`; })();

const niceMax = (v) => {
  const step = v > 200 ? 50 : v > 60 ? 10 : v > 20 ? 5 : v > 8 ? 2 : 1;
  return Math.ceil(v / step) * step;
};

const niceMin = (v) => {
  const step = v > 200 ? 50 : v > 60 ? 10 : v > 20 ? 5 : v > 8 ? 2 : 1;
  return Math.max(0, Math.floor(v / step) * step);
};

/* --------------------------------------------------------------- Tooltip */

function attachTip(host) {
  const tip = document.createElement('div');
  tip.className = 'viz-tip';
  tip.setAttribute('role', 'status');
  tip.setAttribute('aria-live', 'polite');
  host.append(tip);
  return {
    el: tip,
    show(html, xPct, yPct) {
      tip.innerHTML = html;
      tip.dataset.show = 'true';
      const w = tip.offsetWidth;
      const hostW = host.clientWidth;
      let left = (xPct / 100) * hostW - w / 2;
      left = Math.max(4, Math.min(left, hostW - w - 4));
      tip.style.left = `${left}px`;
      tip.style.top = `calc(${yPct}% - ${tip.offsetHeight + 14}px)`;
    },
    hide() { tip.dataset.show = 'false'; },
  };
}

/* ------------------------------------------------------------ Table view */

function tableView(headers, rows, caption) {
  const d = document.createElement('details');
  d.className = 'table-view';
  // The table scrolls inside its own container: a wide one (a heatmap's week
  // columns, say) must never push the page into horizontal overflow.
  d.innerHTML = `
    <summary>View as table</summary>
    <div class="table-scroll" tabindex="0" role="region"
         aria-label="${caption || 'Data table'}, scrollable">
      <table class="data-table">
        ${caption ? `<caption class="sr-only">${caption}</caption>` : ''}
        <thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c, i) =>
          i === 0 ? `<th scope="row" style="font-weight:600;color:var(--text)">${c}</th>` : `<td>${c}</td>`
        ).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
  return d;
}

/* ============================================================ Line / area
   Trend over time, one series. The person's own typical range renders as a
   quiet band behind the line so "is this unusual for me?" is answerable
   without a score being assigned to them.
   ========================================================================= */

function line(host, opts) {
  const {
    values, labels,
    unit = '',
    band = null,          // [lo, hi] the person's own typical range
    baseline = null,      // their own median
    baselineLabel = 'Your usual',
    height = 220,
    label = 'Trend',
  } = opts;

  host.innerHTML = '';
  host.classList.add('chart');

  const W = 680, H = height;
  const padL = 44, padR = 14, padT = 14, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const all = values.concat(band || [], baseline == null ? [] : [baseline]);
  const yMax = niceMax(Math.max.apply(null, all) * 1.08);
  const yMin = niceMin(Math.min.apply(null, all) * 0.92);

  const X = (i) => padL + (values.length === 1 ? plotW / 2 : (i * plotW) / (values.length - 1));
  const Y = (v) => padT + plotH * (1 - (v - yMin) / (yMax - yMin));

  const gid = uid();
  const ticks = 4;
  let g = '';
  for (let t = 0; t <= ticks; t++) {
    const v = yMin + ((yMax - yMin) * t) / ticks;
    const y = Y(v);
    g += `<line class="chart-grid-line" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/>`;
    g += `<text class="chart-tick" x="${padL - 8}" y="${y + 4}" text-anchor="end">${Math.round(v)}</text>`;
  }

  // x labels — thinned so they never collide
  const every = Math.ceil(values.length / 6);
  let xl = '';
  labels.forEach((l, i) => {
    if (i % every === 0 || i === values.length - 1) {
      xl += `<text class="chart-tick" x="${X(i)}" y="${H - 10}" text-anchor="middle">${l}</text>`;
    }
  });

  const bandRect = band
    ? `<rect class="chart-band" x="${padL}" y="${Y(band[1])}" width="${plotW}"
         height="${Math.max(1, Y(band[0]) - Y(band[1]))}" rx="3"/>
       <text class="chart-band-label" x="${padL + 6}" y="${Y(band[1]) + 13}">Your typical range</text>`
    : '';

  const baseLine = baseline != null
    ? `<line class="chart-line--context" x1="${padL}" y1="${Y(baseline)}" x2="${W - padR}" y2="${Y(baseline)}"/>`
    : '';

  const pts = values.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  const areaD = `M ${X(0)},${Y(yMin)} L ${values.map((v, i) => `${X(i)},${Y(v)}`).join(' L ')} L ${X(values.length - 1)},${Y(yMin)} Z`;

  // Direct-label the final point only — never a number on every point.
  const lastX = X(values.length - 1);
  const lastY = Y(values[values.length - 1]);

  host.insertAdjacentHTML('beforeend', `
    <svg viewBox="0 0 ${W} ${H}" role="img"
         aria-label="${label}: ${values[0]}${unit} on ${labels[0]} rising to ${values[values.length - 1]}${unit} on ${labels[labels.length - 1]}. Full values in the table below.">
      <g>${g}</g>
      ${bandRect}
      <line class="chart-axis-line" x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}"/>
      ${baseLine}
      <path class="chart-area" d="${areaD}"/>
      <polyline class="chart-line" points="${pts}"/>
      <circle class="chart-dot" cx="${lastX}" cy="${lastY}" r="4.5"/>
      <text class="chart-tick" x="${lastX}" y="${lastY - 12}" text-anchor="end"
            style="font-weight:800;fill:var(--text)">${values[values.length - 1]}${unit ? ' ' + unit : ''}</text>
      <g id="${gid}-hover" opacity="0">
        <line class="chart-crosshair" y1="${padT}" y2="${padT + plotH}"/>
        <circle class="chart-dot" r="5.5"/>
      </g>
      ${xl}
      <rect class="chart-hit" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}"/>
    </svg>`);

  const svg = host.querySelector('svg');
  const hover = svg.querySelector(`#${gid}-hover`);
  const cross = hover.querySelector('line');
  const dot = hover.querySelector('circle');
  const tip = attachTip(host);

  const hit = svg.querySelector('.chart-hit');
  const move = (e) => {
    const r = svg.getBoundingClientRect();
    const xv = ((e.clientX - r.left) / r.width) * W;
    let i = Math.round(((xv - padL) / plotW) * (values.length - 1));
    i = Math.max(0, Math.min(values.length - 1, i));

    hover.setAttribute('opacity', '1');
    cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i));
    dot.setAttribute('cx', X(i));   dot.setAttribute('cy', Y(values[i]));

    const rows = [`<div class="viz-tip__row"><span>${label}</span><b>${values[i]}${unit ? ' ' + unit : ''}</b></div>`];
    if (baseline != null) rows.push(`<div class="viz-tip__row"><span>${baselineLabel}</span><b>${baseline}</b></div>`);
    tip.show(`<div class="viz-tip__label">${labels[i]}</div>${rows.join('')}`,
             (X(i) / W) * 100, (Y(values[i]) / H) * 100);
  };

  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerleave', () => { hover.setAttribute('opacity', '0'); tip.hide(); });

  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML =
    `<span class="legend__item"><span class="legend__swatch"></span>${label}</span>` +
    (baseline != null ? `<span class="legend__item"><span class="legend__swatch legend__swatch--context"></span>${baselineLabel} (${baseline}${unit ? ' ' + unit : ''})</span>` : '') +
    (band ? `<span class="legend__item"><span class="legend__swatch legend__swatch--band"></span>Your typical range</span>` : '');
  host.append(legend);

  host.append(tableView(['Week', `${label}${unit ? ` (${unit})` : ''}`],
    labels.map((l, i) => [l, values[i]]), `${label} by week`));
}

/* ================================================================== Bars
   Magnitude comparison, single hue. 2px gap between adjacent bars, 4px
   rounded ends anchored to the baseline.
   ========================================================================= */

function bars(host, opts) {
  const {
    values, labels,
    unit = '',
    height = 200,
    label = 'Value',
    rotateLabels = false,
  } = opts;

  host.innerHTML = '';
  host.classList.add('chart');

  const W = 680, H = height;
  const padL = 40, padR = 12, padT = 14, padB = rotateLabels ? 58 : 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const yMax = niceMax(Math.max.apply(null, values) * 1.1);
  const Y = (v) => padT + plotH * (1 - v / yMax);

  const slot = plotW / values.length;
  const bw = Math.max(6, slot - 8);   // >= 2px surface gap between bars

  let g = '';
  for (let t = 0; t <= 4; t++) {
    const v = (yMax * t) / 4;
    const y = Y(v);
    g += `<line class="chart-grid-line" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/>`;
    g += `<text class="chart-tick" x="${padL - 8}" y="${y + 4}" text-anchor="end">${Math.round(v)}</text>`;
  }

  const marks = values.map((v, i) => {
    const x = padL + slot * i + (slot - bw) / 2;
    const h = Math.max(2, plotH - (Y(v) - padT));
    return `<rect class="chart-bar" data-i="${i}" x="${x}" y="${Y(v)}" width="${bw}" height="${h}" rx="4"/>`;
  }).join('');

  const xl = labels.map((l, i) => {
    const cx = padL + slot * i + slot / 2;
    return rotateLabels
      ? `<text class="chart-tick" x="${cx}" y="${H - padB + 16}" text-anchor="end"
           transform="rotate(-40 ${cx} ${H - padB + 16})">${l}</text>`
      : `<text class="chart-tick" x="${cx}" y="${H - 10}" text-anchor="middle">${l}</text>`;
  }).join('');

  host.insertAdjacentHTML('beforeend', `
    <svg viewBox="0 0 ${W} ${H}" role="img"
         aria-label="${label} by ${labels.length} categories. Values in the table below.">
      <g>${g}</g>
      <line class="chart-axis-line" x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}"/>
      ${marks}
      ${xl}
    </svg>`);

  const tip = attachTip(host);
  host.querySelectorAll('.chart-bar').forEach((r) => {
    r.style.cursor = 'pointer';
    r.addEventListener('pointerenter', () => {
      const i = +r.dataset.i;
      r.style.filter = 'brightness(1.12)';
      tip.show(`<div class="viz-tip__label">${labels[i]}</div>
        <div class="viz-tip__row"><span>${label}</span><b>${values[i]}${unit ? ' ' + unit : ''}</b></div>`,
        ((+r.getAttribute('x') + bw / 2) / W) * 100, (Y(values[i]) / H) * 100);
    });
    r.addEventListener('pointerleave', () => { r.style.filter = ''; tip.hide(); });
  });

  host.append(tableView([opts.dimension || 'Group', `${label}${unit ? ` (${unit})` : ''}`],
    labels.map((l, i) => [l, values[i]]), `${label} by ${opts.dimension || 'group'}`));
}

/* =========================================================== Horizontal bars
   For cohort comparison with long names. Locked cohorts are passed in but
   render as an explicit suppression row — never a bar, never an estimate.
   ========================================================================= */

function hbars(host, opts) {
  const { rows, unit = '', label = 'Value', max = null } = opts;

  host.innerHTML = '';
  host.classList.add('chart');

  const open = rows.filter((r) => !r.locked);
  const yMax = niceMax(max || Math.max.apply(null, open.map((r) => r.value)) * 1.1);

  const list = document.createElement('div');
  list.className = 'stack stack--tight';

  rows.forEach((r) => {
    const row = document.createElement('div');
    if (r.locked) {
      row.innerHTML = `
        <div class="row row--between" style="gap:var(--s-3)">
          <span style="font-size:var(--fs-sm);font-weight:600;color:var(--text-subtle)">${r.name}</span>
          <span class="chip" style="font-size:11px;white-space:normal">
            ${WW.icon('lock', { size: 12 })} Not shown · ${r.n} people
          </span>
        </div>
        <div class="meter__track" style="margin-top:6px;background:repeating-linear-gradient(
             45deg, var(--surface-3) 0 6px, var(--surface-2) 6px 12px)"></div>`;
    } else {
      const pct = (r.value / yMax) * 100;
      row.innerHTML = `
        <div class="row row--between" style="gap:var(--s-3)">
          <span style="font-size:var(--fs-sm);font-weight:600">${r.name}
            <span class="t-subtle" style="font-weight:500">· ${r.n} people</span></span>
          <b class="t-num" style="font-size:var(--fs-sm)">${r.value}${unit ? ' ' + unit : ''}</b>
        </div>
        <div class="meter__track" style="margin-top:6px">
          <div class="meter__fill" style="width:${pct}%;background:var(--seq-500)"></div>
        </div>`;
    }
    list.append(row);
  });

  host.append(list);

  host.append(tableView(['Group', 'People', `${label}${unit ? ` (${unit})` : ''}`],
    rows.map((r) => [r.name, r.locked ? `${r.n}` : `${r.n}`,
      r.locked ? 'Not shown (group under 8)' : r.value]),
    `${label} by group`));
}

/* ============================================================== Heatmap
   Single-hue sequential grid — "how often", never "who".
   ========================================================================= */

function heat(host, opts) {
  const { rows, cols, values, label = 'Share of weeks over contracted hours' } = opts;

  host.innerHTML = '';
  host.classList.add('chart');

  const steps = ['var(--seq-100)', 'var(--seq-200)', 'var(--seq-300)',
                 'var(--seq-400)', 'var(--seq-500)', 'var(--seq-600)'];
  const stepFor = (v) => steps[Math.min(steps.length - 1, Math.floor(v * steps.length))];

  const wrap = document.createElement('div');
  wrap.style.overflowX = 'auto';

  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `minmax(96px, auto) repeat(${cols.length}, minmax(30px, 1fr))`;
  grid.style.gap = '2px';
  grid.style.minWidth = '440px';
  grid.style.alignItems = 'center';

  grid.insertAdjacentHTML('beforeend', '<span></span>');
  cols.forEach((c) => grid.insertAdjacentHTML('beforeend',
    `<span class="t-subtle" style="text-align:center;font-size:11px;font-weight:700">${c}</span>`));

  const tip = attachTip(host);
  host.style.position = 'relative';

  rows.forEach((r, ri) => {
    grid.insertAdjacentHTML('beforeend',
      `<span style="font-size:var(--fs-xs);font-weight:600;padding-right:var(--s-2)">${r}</span>`);
    cols.forEach((c, ci) => {
      const v = values[ri][ci];
      const cell = document.createElement('div');
      cell.className = 'heat__cell';
      cell.style.background = stepFor(v);
      cell.tabIndex = 0;
      cell.setAttribute('role', 'img');
      cell.setAttribute('aria-label', `${r}, ${c}: ${Math.round(v * 100)} percent`);
      const show = () => {
        const b = cell.getBoundingClientRect();
        const hb = host.getBoundingClientRect();
        tip.show(`<div class="viz-tip__label">${r} · ${c}</div>
          <div class="viz-tip__row"><span>${label}</span><b>${Math.round(v * 100)}%</b></div>`,
          ((b.left + b.width / 2 - hb.left) / hb.width) * 100,
          ((b.top - hb.top) / hb.height) * 100);
      };
      cell.addEventListener('pointerenter', show);
      cell.addEventListener('focus', show);
      cell.addEventListener('pointerleave', tip.hide);
      cell.addEventListener('blur', tip.hide);
      grid.append(cell);
    });
  });

  wrap.append(grid);
  host.append(wrap);

  // Sequential scale legend
  const key = document.createElement('div');
  key.className = 'legend';
  key.innerHTML = `<span class="legend__item">Less often</span>` +
    steps.map((s) => `<span class="legend__swatch" style="width:22px;height:10px;border-radius:3px;background:${s}"></span>`).join('') +
    `<span class="legend__item">More often</span>`;
  host.append(key);

  host.append(tableView(['Group'].concat(cols),
    rows.map((r, ri) => [r].concat(values[ri].map((v) => `${Math.round(v * 100)}%`))),
    label));
}

/* ============================================================= Sparkline */

function spark(host, values, opts) {
  const { height = 40 } = opts || {};
  const W = 120, H = height;
  const max = Math.max.apply(null, values);
  const min = Math.min.apply(null, values);
  const rng = max - min || 1;
  const X = (i) => (i * W) / (values.length - 1);
  const Y = (v) => 4 + (H - 8) * (1 - (v - min) / rng);
  host.classList.add('chart');
  host.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" style="height:${H}px">
      <polyline class="chart-line" points="${values.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}"/>
    </svg>`;
}

WW.charts = { line, bars, hbars, heat, spark, tableView };

})(window.WW);
