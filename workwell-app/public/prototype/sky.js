/* ==========================================================================
   WorkWell — Sky

   A living backdrop for the office: sunrise, day, sunset and night, driven by
   the same clock as the room, so the sky and the wall clock always agree.

   Style is blocky on purpose — stepped colour bands and pixel-grid sun, moon
   and stars, drawn from scratch rather than lifted from anywhere.

   It is decoration and must never cost legibility: the sky sits behind
   everything, all text-bearing chrome keeps an opaque-ish scrim, and the
   office floor itself is opaque. Nothing here is announced to assistive tech.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

/* Colour stops through the day: [top of sky, middle, horizon].
   Interpolated between, so the sky changes continuously rather than
   snapping between four states. */
const STOPS = [
  { t:    0, c: ['#080C1E', '#101637', '#19204A'] },  // deep night
  { t:  270, c: ['#0C1228', '#1A2148', '#2E2C57'] },  // 4:30 am, first shift
  { t:  345, c: ['#1B2B52', '#4A3A66', '#8A5A6B'] },  // 5:45 pre-dawn
  { t:  400, c: ['#2E4C82', '#B06E52', '#F0A25C'] },  // 6:40 sunrise
  { t:  460, c: ['#3F73B4', '#7FADD8', '#DCC9A6'] },  // 7:40 early morning
  { t:  600, c: ['#3A78BE', '#6BA5DA', '#A9CDEA'] },  // 10:00 morning
  { t:  780, c: ['#3271BC', '#63A0D8', '#9FC7E8'] },  // 1:00 pm full day
  { t:  960, c: ['#3D79BB', '#7CACDC', '#C6CFC6'] },  // 4:00 pm
  { t: 1050, c: ['#41608F', '#B07A62', '#E8B173'] },  // 5:30 pm going gold
  { t: 1110, c: ['#2A3C6E', '#C4653C', '#F09A55'] },  // 6:30 sunset
  { t: 1170, c: ['#1C2A55', '#5E3A5E', '#96556A'] },  // 7:30 dusk
  { t: 1260, c: ['#0F1636', '#1E2547', '#33305C'] },  // 9:00 pm
  { t: 1440, c: ['#080C1E', '#101637', '#19204A'] },  // wraps to night
];

const SUNRISE = 360;    // 6:00 am
const SUNSET  = 1110;   // 6:30 pm
const ARC     = SUNSET - SUNRISE;

/* ---------------------------------------------------------------- Colour */

function hexToRgb(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function mix(a, b, f) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${A.map((n, i) => Math.round(n + (B[i] - n) * f)).join(',')})`;
}

function skyAt(mins) {
  let i = 0;
  while (i < STOPS.length - 1 && STOPS[i + 1].t <= mins) i += 1;
  const a = STOPS[i];
  const b = STOPS[Math.min(i + 1, STOPS.length - 1)];
  const span = Math.max(1, b.t - a.t);
  const f = Math.min(1, Math.max(0, (mins - a.t) / span));
  return a.c.map((_, k) => mix(a.c[k], b.c[k], f));
}

/** 0 at night, 1 in full day. Drives star and cloud opacity. */
function daylight(mins) {
  if (mins <= SUNRISE - 60 || mins >= SUNSET + 60) return 0;
  if (mins >= SUNRISE + 40 && mins <= SUNSET - 40) return 1;
  if (mins < SUNRISE + 40) return (mins - (SUNRISE - 60)) / 100;
  return ((SUNSET + 60) - mins) / 100;
}

/** Where the sun or moon sits on its arc, in percentages of the viewport. */
function bodyAt(mins) {
  const isDay = mins >= SUNRISE && mins < SUNSET;
  const t = isDay
    ? (mins - SUNRISE) / ARC
    : (((mins - SUNSET) + 1440) % 1440) / ((1440 - SUNSET) + SUNRISE);
  return {
    type: isDay ? 'sun' : 'moon',
    x: 6 + t * 88,                       // left to right
    y: 82 - Math.sin(t * Math.PI) * 66,  // arcs up and back down
  };
}

/* ------------------------------------------------------------------- Art */

/** Pixel-grid sun. Blocky by design — no gradients, no glow bloom. */
function sunSVG() {
  const px = [
    '..YYYY..',
    '.YYWWYY.',
    'YYWWWWYY',
    'YWWWWWWY',
    'YWWWWWWY',
    'YYWWWWYY',
    '.YYWWYY.',
    '..YYYY..',
  ];
  const fill = { Y: '#F2B33D', W: '#FFE07A' };
  let r = '';
  px.forEach((row, y) => [...row].forEach((ch, x) => {
    if (fill[ch]) r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill[ch]}"/>`;
  }));
  return `<svg viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
}

/** Pixel-grid moon with a few craters. */
function moonSVG() {
  const px = [
    '..MMMM..',
    '.MMMMMM.',
    'MMCMMMMM',
    'MMMMMCMM',
    'MMMMMMMM',
    'MMCMMMMM',
    '.MMMMMM.',
    '..MMMM..',
  ];
  const fill = { M: '#E8EAF2', C: '#BFC4D6' };
  let r = '';
  px.forEach((row, y) => [...row].forEach((ch, x) => {
    if (fill[ch]) r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill[ch]}"/>`;
  }));
  return `<svg viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
}

/* Deterministic star field — same every load, so screenshots are stable. */
function stars(n) {
  let seed = 20260806;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = rand() * 100;
    const y = rand() * 62;                 // keep them off the horizon
    const s = rand() < 0.22 ? 3 : 2;       // a few brighter, blockier ones
    const o = 0.45 + rand() * 0.55;
    out += `<i class="sky__star" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;
             width:${s}px;height:${s}px;opacity:${o.toFixed(2)}"></i>`;
  }
  return out;
}

/* Blocky clouds, built from a few stacked rectangles each. */
function clouds() {
  const shapes = [
    { top: 14, dur: 190, delay: 0,   scale: 1.0 },
    { top: 26, dur: 260, delay: -70, scale: 0.72 },
    { top: 8,  dur: 320, delay: -160, scale: 0.55 },
  ];
  return shapes.map((c) => `
    <div class="sky__cloud" style="top:${c.top}%;--dur:${c.dur}s;
         animation-delay:${c.delay}s;transform:scale(${c.scale})">
      <span style="left:0;   top:14px; width:96px; height:20px"></span>
      <span style="left:22px;top:0;    width:52px; height:20px"></span>
      <span style="left:60px;top:8px;  width:44px; height:16px"></span>
    </div>`).join('');
}

/* ----------------------------------------------------------------- Mount */

function mountSky() {
  const el = document.createElement('div');
  el.className = 'sky';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="sky__grad"></div>
    <div class="sky__stars">${stars(70)}</div>
    <div class="sky__clouds">${clouds()}</div>
    <div class="sky__body"></div>`;
  document.body.prepend(el);
  document.body.classList.add('has-sky');

  const grad = el.querySelector('.sky__grad');
  const starLayer = el.querySelector('.sky__stars');
  const cloudLayer = el.querySelector('.sky__clouds');
  const body = el.querySelector('.sky__body');

  let lastType = null;

  function paint() {
    const mins = WW.room ? WW.room.nowMinutes() : (() => {
      const d = new Date(); return d.getHours() * 60 + d.getMinutes();
    })();

    const [top, mid, horizon] = skyAt(mins);
    // Stepped bands rather than a smooth wash — the blocky look.
    grad.style.background =
      `linear-gradient(to bottom,
         ${top} 0%, ${top} 26%,
         ${mid} 42%, ${mid} 62%,
         ${horizon} 82%, ${horizon} 100%)`;

    const day = daylight(mins);
    starLayer.style.opacity = String(1 - day);
    cloudLayer.style.opacity = String(0.30 + day * 0.55);

    const b = bodyAt(mins);
    if (b.type !== lastType) {
      body.innerHTML = b.type === 'sun' ? sunSVG() : moonSVG();
      body.dataset.type = b.type;
      lastType = b.type;
    }
    body.style.left = `${b.x}%`;
    body.style.top = `${b.y}%`;
  }

  paint();
  // A minute's worth of change is imperceptible, so no animation is needed —
  // just keep it honest with the clock.
  window.setInterval(paint, 30000);

  WW.sky = { paint, skyAt, bodyAt, daylight };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountSky);
} else {
  mountSky();
}

})(window.WW);
