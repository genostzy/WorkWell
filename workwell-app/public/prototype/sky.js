/* ==========================================================================
   WorkWell — Sky

   A living backdrop for the office: sunrise, day, sunset and night, driven by
   the same clock as the room, so the sky and the wall clock always agree.

   Realistic, not blocky: a smooth continuous gradient rather than stepped
   colour bands, a soft radial sun/moon instead of a pixel grid, and clouds
   built from overlapping blurred circles rather than stacked rectangles.
   The palette is muted/atmospheric on purpose — a hazy, photographed sky
   rather than a saturated cartoon one — since colour here is the one place
   in the product that still carries it, and it should read as weather, not
   as a UI accent.

   It is decoration and must never cost legibility: the sky sits behind
   everything, all text-bearing chrome keeps an opaque-ish scrim, and the
   office floor itself is opaque. Nothing here is announced to assistive tech.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

/* Colour stops through the day: [top of sky, middle, horizon]. Muted and
   atmospheric — every stop desaturated a step from a "pure" sunrise/sky
   blue/sunset, the way haze and distance actually mute a real sky, and so
   daytime doesn't read as a wall of saturated blue. Interpolated between,
   so the sky changes continuously rather than snapping between states. */
const STOPS = [
  { t:    0, c: ['#12162C', '#1C2140', '#262A4A'] },  // deep night
  { t:  270, c: ['#151A32', '#232948', '#302D4E'] },  // 4:30 am, first shift
  { t:  345, c: ['#332C4C', '#5A4459', '#93615F'] },  // 5:45 pre-dawn
  { t:  400, c: ['#4A4E76', '#B5786A', '#E7A672'] },  // 6:40 sunrise
  { t:  460, c: ['#5D7CA3', '#96AFC4', '#E3CBA9'] },  // 7:40 early morning
  { t:  600, c: ['#5E88B0', '#8FB2C9', '#C9DCE0'] },  // 10:00 morning
  { t:  780, c: ['#5A84AE', '#89AEC6', '#C1D6DC'] },  // 1:00 pm full day
  { t:  960, c: ['#628AAE', '#93B4C6', '#D3DED3'] },  // 4:00 pm
  { t: 1050, c: ['#556487', '#B08D77', '#E5BE93'] },  // 5:30 pm going gold
  { t: 1110, c: ['#3E4368', '#B3715C', '#E29A72'] },  // 6:30 sunset
  { t: 1170, c: ['#332C58', '#5F4460', '#8F5D68'] },  // 7:30 dusk
  { t: 1260, c: ['#1B1E3C', '#282A4C', '#38344F'] },  // 9:00 pm
  { t: 1440, c: ['#12162C', '#1C2140', '#262A4A'] },  // wraps to night
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

/** Soft radial sun — a warm core fading through the disc, the glow bloom
 *  handled separately by the CSS halo behind it. */
function sunSVG() {
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <radialGradient id="wwSun" cx="42%" cy="38%" r="62%">
        <stop offset="0%" stop-color="#FFF6DC"/>
        <stop offset="55%" stop-color="#FFDD82"/>
        <stop offset="100%" stop-color="#F0AE45"/>
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="42" fill="url(#wwSun)"/>
  </svg>`;
}

/** Soft radial moon, a few blurred crater shadows rather than flat cutouts. */
function moonSVG() {
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <radialGradient id="wwMoon" cx="38%" cy="34%" r="68%">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="55%" stop-color="#E7EAF3"/>
        <stop offset="100%" stop-color="#C3C9DE"/>
      </radialGradient>
      <filter id="wwMoonBlur"><feGaussianBlur stdDeviation="1.6"/></filter>
    </defs>
    <circle cx="50" cy="50" r="42" fill="url(#wwMoon)"/>
    <g filter="url(#wwMoonBlur)" fill="#B6BCD4" opacity="0.55">
      <circle cx="35" cy="38" r="7"/>
      <circle cx="61" cy="57" r="5.5"/>
      <circle cx="44" cy="66" r="4"/>
    </g>
  </svg>`;
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
    const s = rand() < 0.18 ? 2.4 : 1.4;   // a few brighter, most a soft pinprick
    const o = 0.35 + rand() * 0.55;
    out += `<i class="sky__star" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;
             width:${s}px;height:${s}px;opacity:${o.toFixed(2)}"></i>`;
  }
  return out;
}

/* Soft cumulus clouds — a handful of overlapping, blurred circles rather
   than stacked rectangles, so the silhouette reads as fluffy rather than
   architectural. */
function clouds() {
  const shapes = [
    { top: 14, dur: 190, delay: 0,   scale: 1.0 },
    { top: 26, dur: 260, delay: -70, scale: 0.72 },
    { top: 8,  dur: 320, delay: -160, scale: 0.55 },
  ];
  const puffs = [
    { left: 0,   top: 18, w: 62, h: 46 },
    { left: 32,  top: 2,  w: 54, h: 54 },
    { left: 66,  top: 14, w: 46, h: 40 },
    { left: 14,  top: 26, w: 100, h: 32 },
  ];
  return shapes.map((c) => `
    <div class="sky__cloud" style="top:${c.top}%;--dur:${c.dur}s;
         animation-delay:${c.delay}s;transform:scale(${c.scale})">
      ${puffs.map((p) => `<span style="left:${p.left}px;top:${p.top}px;width:${p.w}px;height:${p.h}px"></span>`).join('')}
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
    // A smooth continuous wash, the way an actual sky's colour changes with
    // altitude — no hard steps between bands.
    grad.style.background =
      `linear-gradient(to bottom, ${top} 0%, ${mid} 55%, ${horizon} 100%)`;

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
