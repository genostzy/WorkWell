/* ==========================================================================
   WorkWell — Scale drawings

   Each scale supplies only its own SVG for a value of 1-5. The slider
   behaviour, keyboard support and accessibility all live in dragscale.js.

   Both drawings use a single accent colour at every level. Colouring "empty"
   red would be a verdict on the person, which this product refuses to do.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

/* ======================================================== Mood — the face
   Drag either mouth corner. Corners rise with mood while the control point
   falls, so value 3 is a flat line.
   ===================================================================== */

const MOUTH_X1 = 62;
const MOUTH_X2 = 138;

const cornerY    = (v) => 134 - (v - 3) * 6;
const controlY   = (v) => 134 + (v - 3) * 17;
const browOuterY = (v) => 62 + (3 - v) * 3;
const browInnerY = (v) => 58 - (3 - v) * 3;

WW.defineScale('mood', {
  label: 'Mood',
  words:  ['', 'Low', 'Not great', 'OK', 'Good', 'Great'],
  blurbs: ['',
    'A rough one. That is worth knowing about.',
    'Not your best day.',
    'Somewhere in the middle.',
    'A good day.',
    'A really good day.'],
  hint: 'Drag the corners of the mouth up or down — or use the arrow keys.',
  axis: 'y',
  valueAt: (x, y) => WW.lerp15(182, 88)(y),
  draw(v) {
    const cy = cornerY(v), qy = controlY(v);
    const bo = browOuterY(v), bi = browInnerY(v);
    return `
    <svg class="dragscale__svg" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle class="mf-face" cx="100" cy="100" r="88"/>
      <line class="mf-brow" x1="54"  y1="${bo}" x2="86"  y2="${bi}"/>
      <line class="mf-brow" x1="146" y1="${bo}" x2="114" y2="${bi}"/>
      <circle class="mf-eye" cx="72"  cy="92" r="9"/>
      <circle class="mf-eye" cx="128" cy="92" r="9"/>
      <path class="mf-mouth" d="M ${MOUTH_X1} ${cy} Q 100 ${qy} ${MOUTH_X2} ${cy}"/>
      <circle class="ds-grip" cx="${MOUTH_X1}" cy="${cy}" r="10"/>
      <circle class="ds-grip" cx="${MOUTH_X2}" cy="${cy}" r="10"/>
    </svg>`;
  },
});

/* ==================================================== Energy — the battery
   Drag the fill line. "Running on 10%" is already how people describe their
   own energy, so the metaphor needs no explaining and carries no judgement.
   ===================================================================== */

const FILL_TOP = 34;          // inner area, viewBox units
const FILL_H   = 142;
const FILL_BOT = FILL_TOP + FILL_H;
const LEVEL    = [0, 0.07, 0.27, 0.50, 0.74, 0.95];

/* clipPath ids share the document, so key them per render rather than per
   value — otherwise two batteries on one page would clip to each other. */
let clipSeq = 0;

WW.defineScale('energy', {
  label: 'Energy',
  words:  ['', 'Empty', 'Low', 'Steady', 'Good', 'High'],
  blurbs: ['',
    'Running on empty.',
    'Not much in the tank.',
    'Enough to get through the day.',
    'Plenty to work with.',
    'Full charge.'],
  hint: 'Drag the fill line up or down — or use the arrow keys.',
  axis: 'y',
  valueAt: (x, y) => WW.lerp15(172, 45)(y),
  draw(v) {
    const fh = LEVEL[v] * FILL_H;
    const fy = FILL_BOT - fh;
    const id = 'bclip' + (++clipSeq);

    // Fizz only at the top of the range — personality, not a score.
    const fizz = v >= 4 ? `
      <g class="bt-fizz" opacity="${v === 5 ? 1 : 0.5}">
        <line x1="34" y1="72" x2="20" y2="62"/>
        <line x1="32" y1="100" x2="16" y2="100"/>
        <line x1="166" y1="72" x2="180" y2="62"/>
        <line x1="168" y1="100" x2="184" y2="100"/>
      </g>` : '';

    return `
    <svg class="dragscale__svg" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs><clipPath id="${id}"><rect x="64" y="34" width="72" height="142" rx="15"/></clipPath></defs>
      <rect class="bt-cap"  x="85" y="16" width="30" height="14" rx="5"/>
      <rect class="bt-body" x="58" y="28" width="84" height="154" rx="20"/>
      <g clip-path="url(#${id})">
        <rect class="bt-fill" x="64" y="${fy}" width="72" height="${fh + 10}"/>
      </g>
      ${fizz}
      <circle class="ds-grip" cx="58"  cy="${fy}" r="10"/>
      <circle class="ds-grip" cx="142" cy="${fy}" r="10"/>
    </svg>`;
  },
});

/* ================================================= Pressure — the squeeze
   Two plates press inward and the shape squashes. Horizontal, so after two
   vertical drags it feels different without anything new to learn.

   Value maps from distance to centre, not from a left/right axis — so it
   behaves identically whichever plate you grab.

   Deliberately not a gauge with a needle: a dial reads as an instrument
   measuring *you*, and is one red zone away from the burnout score this
   product refuses to have. A squeeze is about the situation.
   ===================================================================== */

WW.defineScale('pressure', {
  label: 'Pressure',
  words:  ['', 'Calm', 'Settled', 'Noticeable', 'High', 'Very high'],
  blurbs: ['',
    'Nothing pressing.',
    'Steady, nothing unusual.',
    'You can feel it.',
    'A lot on you right now.',
    'More than is reasonable.'],
  hint: 'Drag either plate inward or outward — or use the arrow keys.',
  axis: 'x',
  // 78 units from centre = calm, 8 = very high.
  valueAt: (x, y) => WW.lerp15(78, 8)(Math.abs(x - 100)),
  draw(v) {
    const t = (v - 1) / 4;
    const gap = 78 - t * 44;          // centre to plate inner face
    const rx  = gap - 6;
    const ry  = 60 + t * 26;

    // Strain marks appear only once the shape is genuinely compressed.
    const strain = v >= 4 ? `
      <g class="pr-strain" opacity="${v === 5 ? 1 : 0.45}">
        <line x1="100" y1="${100 - ry - 12}" x2="100" y2="${100 - ry - 22}"/>
        <line x1="${100 - rx / 2}" y1="${100 - ry - 6}" x2="${100 - rx / 2 - 8}" y2="${100 - ry - 16}"/>
        <line x1="${100 + rx / 2}" y1="${100 - ry - 6}" x2="${100 + rx / 2 + 8}" y2="${100 - ry - 16}"/>
      </g>` : '';

    return `
    <svg class="dragscale__svg" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <ellipse class="pr-blob" cx="100" cy="100" rx="${rx}" ry="${ry}"/>
      ${strain}
      <rect class="pr-plate" x="${100 - gap - 14}" y="26" width="14" height="148" rx="7"/>
      <rect class="pr-plate" x="${100 + gap}"      y="26" width="14" height="148" rx="7"/>
      <circle class="ds-grip" cx="${100 - gap - 7}" cy="100" r="10"/>
      <circle class="ds-grip" cx="${100 + gap + 7}" cy="100" r="10"/>
    </svg>`;
  },
});

/* ================================================= Workload — the balance
   Left pan is what you can take; right pan is what is on you. The beam
   levels at "About right", so the good answer is visibly the balanced one —
   something a fill level cannot express, because workload is a centred
   scale rather than a more-is-better one.

   Note: dragging the work pan DOWN adds work, because that is what weight
   does. Arrow keys still follow the ARIA convention (Up/Right increase the
   value), so on this one scale the key direction and the pan direction
   differ. The word readout is authoritative for both.
   ===================================================================== */

const PIVOT_X = 100;
const PIVOT_Y = 86;
const ARM = 68;
const TILT_PER_STEP = 9;              // degrees

function beamEnds(v) {
  const a = ((v - 3) * TILT_PER_STEP * Math.PI) / 180;
  const dx = ARM * Math.cos(a);
  const dy = ARM * Math.sin(a);
  return {
    lx: PIVOT_X - dx, ly: PIVOT_Y - dy,
    rx: PIVOT_X + dx, ry: PIVOT_Y + dy,
  };
}

function panBlocks(cx, panTop, n) {
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `<rect class="wl-block" x="${cx - 13}" y="${panTop - 10 - i * 11}"
              width="26" height="9" rx="2.5"/>`;
  }
  return out;
}

WW.defineScale('workload', {
  label: 'Workload',
  words:  ['', 'Light', 'Manageable', 'About right', 'Heavy', 'Too much'],
  blurbs: ['',
    'Room to spare.',
    'Comfortable.',
    'Balanced — the work matches what you can take.',
    'More than is comfortable.',
    'Beyond what this should be.'],
  hint: 'Drag the right pan up or down — or use the arrow keys.',
  axis: 'y',
  valueAt: (x, y) => WW.lerp15(55, 150)(y),
  draw(v) {
    const e = beamEnds(v);
    const lPan = e.ly + 24;
    const rPan = e.ry + 24;

    return `
    <svg class="dragscale__svg" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <line class="wl-ref" x1="26" y1="${PIVOT_Y}" x2="174" y2="${PIVOT_Y}"/>

      <path class="wl-stand" d="M100 90 L82 156 L118 156 Z"/>
      <line class="wl-base" x1="58" y1="158" x2="142" y2="158"/>

      <line class="wl-beam" x1="${e.lx}" y1="${e.ly}" x2="${e.rx}" y2="${e.ry}"/>
      <circle class="wl-pivot" cx="${PIVOT_X}" cy="${PIVOT_Y}" r="7"/>

      <line class="wl-hanger" x1="${e.lx}" y1="${e.ly}" x2="${e.lx}" y2="${lPan}"/>
      <line class="wl-hanger" x1="${e.rx}" y1="${e.ry}" x2="${e.rx}" y2="${rPan}"/>
      <rect class="wl-pan" x="${e.lx - 22}" y="${lPan}" width="44" height="7" rx="3.5"/>
      <rect class="wl-pan" x="${e.rx - 22}" y="${rPan}" width="44" height="7" rx="3.5"/>

      ${panBlocks(e.lx, lPan, 3)}
      ${panBlocks(e.rx, rPan, v)}

      <circle class="ds-grip" cx="${e.rx}" cy="${rPan + 3}" r="10"/>
    </svg>`;
  },
});

})(window.WW);
