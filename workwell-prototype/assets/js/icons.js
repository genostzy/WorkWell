/* ==========================================================================
   WorkWell — Icon set
   Stroke icons on a 24x24 grid, currentColor, 1.8 stroke. Rounded joins to
   match the typeface's soft geometry.

   Loaded as a classic script (not a module) so the app opens straight from
   the filesystem — file:// blocks ES module imports.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

const P = (d) => `<path d="${d}"/>`;

const ICONS = {
  /* --- brand / plane --------------------------------------------------- */
  leaf:   P('M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z') + P('M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'),
  lock:   P('M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z') + P('M7 11V7a5 5 0 0 1 10 0v4'),
  building: P('M4 21V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15') + P('M12 10h7a1 1 0 0 1 1 1v10') + P('M7 9h1M7 13h1M7 17h1M16 14h1M16 18h1') + P('M2 21h20'),

  /* --- navigation ------------------------------------------------------ */
  trend:  P('M3 3v16a2 2 0 0 0 2 2h16') + P('m7 14 3.5-3.5 2.5 2.5L20 6'),
  heart:  P('M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'),
  bell:   P('M10.27 21a2 2 0 0 0 3.46 0') + P('M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.4 13.92 18 12.5 18 8a6 6 0 0 0-12 0c0 4.5-1.4 5.92-2.74 7.33Z'),
  moon:   P('M12 3a6.36 6.36 0 0 0 9 9 9 9 0 1 1-9-9Z'),
  users:  P('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2') + P('M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z') + P('M22 21v-2a4 4 0 0 0-3-3.87') + P('M16 3.13a4 4 0 0 1 0 7.75'),
  sliders: P('M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3') + P('M1 14h6M9 8h6M17 16h6'),
  grid:   P('M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z'),

  /* --- states & actions ------------------------------------------------ */
  sun:    P('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z') + P('M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'),
  moonFill: P('M12 3a6.36 6.36 0 0 0 9 9 9 9 0 1 1-9-9Z'),
  info:   P('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z') + P('M12 16v-5M12 8h.01'),
  alert:  P('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z') + P('M12 8v5M12 16h.01'),
  clock:  P('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z') + P('M12 6v6l4 2'),
  calendar: P('M5 4h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z') + P('M4 9h16M8 2v4M16 2v4'),
  inbox:  P('M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z') + P('M3 13h5l1 3h6l1-3h5'),
  send:   P('m22 2-7 20-4-9-9-4Z') + P('M22 2 11 13'),
  coffee: P('M17 8h1a4 4 0 0 1 0 8h-1') + P('M3 8h14v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z') + P('M6 2v2M10 2v2M14 2v2'),
  sparkle: P('m12 3 1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4Z') + P('M19 15l.7 2L21.7 18l-2 .7-.7 2-.7-2-2-.7 2-.7Z'),
  eyeOff: P('M10.7 5.1A9.9 9.9 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-2.6 3.4M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 5.4-1.6') + P('M9.9 9.9a3 3 0 0 0 4.2 4.2') + P('M2 2l20 20'),
  shield: P('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z') + P('m9 12 2 2 4-4'),
  drop:   P('M12 22a7 7 0 0 0 7-7c0-4-7-12-7-12S5 11 5 15a7 7 0 0 0 7 7Z'),
  eye:    P('M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z') + P('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'),
  walk:   P('M13 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z') + P('m9 21 2-5 2-3-1-5-3 2-1 3') + P('m13 13 3 2 1 6M11 8l4 1 2 3'),
  stretch: P('M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z') + P('M12 7v7M5 10h14M9 21l3-7 3 7'),
  more:   P('M5 12h.01M12 12h.01M19 12h.01'),
  x:      P('M18 6 6 18M6 6l12 12'),
  check:  P('m4 12 5 5L20 6'),
  chevronRight: P('m9 6 6 6-6 6'),
  chevronLeft: P('m15 6-6 6 6 6'),
  arrowUp: P('M12 19V5M5 12l7-7 7 7'),
  arrowDown: P('M12 5v14M19 12l-7 7-7-7'),
  arrowRight: P('M5 12h14M12 5l7 7-7 7'),
  minus:  P('M5 12h14'),
  plus:   P('M12 5v14M5 12h14'),
  filter: P('M3 5h18l-7 8v6l-4 2v-8Z'),
  refresh: P('M21 12a9 9 0 1 1-3-6.7L21 8') + P('M21 3v5h-5'),
  wifiOff: P('M2 2l20 20') + P('M8.5 16.5a5 5 0 0 1 7 0') + P('M5 12.9a10 10 0 0 1 4-2.6M2 8.8A15 15 0 0 1 7 6M19.4 12.9A10 10 0 0 0 14 10.1M22 8.8a15 15 0 0 0-6.6-3.5') + P('M12 20h.01'),
  seedling: P('M12 21V9') + P('M12 12C9 12 6 10 6 6c4 0 6 2.5 6 6Z') + P('M12 11c0-3.5 2-6 6-6 0 4-3 6-6 6Z'),
  chart:  P('M4 20h16') + P('M7 20v-6M12 20V7M17 20v-9'),
  target: P('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z') + P('M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z') + P('M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'),
  book:   P('M4 4a2 2 0 0 1 2-2h13v18H6a2 2 0 0 0-2 2Z') + P('M4 20h15'),
};

/**
 * Render an icon as an inline SVG string.
 * Icons are decorative by default; pass a label to expose one to AT.
 */
function icon(name, opts) {
  const { size = 20, label = null, cls = '' } = opts || {};
  const body = ICONS[name];
  if (!body) return '';
  const a11y = label
    ? `role="img" aria-label="${label}"`
    : 'aria-hidden="true" focusable="false"';
  return `<svg ${a11y} class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/**
 * The WorkWell mark — a filled tile carrying the W-and-heart glyph.
 *
 * Deliberately not in ICONS: those are 24x24 currentColor strokes, and this is
 * a two-tone filled shape whose strokes bleed off the tile edge, so it needs
 * its own clip and its own fills. The tile takes --accent, which means the
 * mark carries plane colour like the rest of the chrome does.
 *
 * The clip path needs a document-unique id — the mark appears twice on a page
 * (sidebar and mobile topbar) and duplicate ids would collapse to one clip.
 */
let markSeq = 0;

function brandmark(opts) {
  const { size = 34, label = null } = opts || {};
  const clip = `ww-mark-${++markSeq}`;
  const a11y = label
    ? `role="img" aria-label="${label}"`
    : 'aria-hidden="true" focusable="false"';
  /* Tokens go in `style` rather than the fill/stroke attributes. Chrome
     resolves var() in a presentation attribute, but support is not uniform
     and a failure there is silent — the shape just paints black. */
  return `<svg ${a11y} width="${size}" height="${size}" viewBox="0 0 32 32">
    <defs><clipPath id="${clip}"><rect width="32" height="32" rx="3.4"/></clipPath></defs>
    <rect width="32" height="32" rx="3.4" style="fill:var(--accent)"/>
    <g clip-path="url(#${clip})" stroke-width="3.3"
       style="fill:none;stroke:var(--text-on-accent)">
      <path d="M-2 6.6 L 7.6 19.2 L 15.6 8.4 L 28.8 34"/>
      <path d="M21.5 10.5 L 25.9 5.8 L 34 16.7"/>
    </g>
    <path style="fill:var(--text-on-accent)"
      d="M7.4 7.35C5.15 5.75 4.85 4.3 5.55 3.4c.73-.92 1.57-.5 1.85.15.28-.65 1.12-1.07 1.85-.15.7.9.4 2.35-1.85 3.95Z"/>
  </svg>`;
}

WW.ICONS = ICONS;
WW.icon = icon;
WW.brandmark = brandmark;

})(window.WW);
