/* ==========================================================================
   WorkWell — Drag scale

   A 1-5 value you set by dragging a drawing up and down. The drawing is
   supplied by the caller; everything that makes it *usable* lives here.

   It is an ARIA slider first and a drag toy second. Drag-only would exclude
   keyboard users, screen-reader users, and anyone who can't hold a precise
   drag — several of whom are this product's stated audience. So the same
   control takes arrow keys, announces its value in words, and offers the
   words as chips.

   The drawing is always rendered from the rounded value, never from the raw
   pointer position, so what you see is exactly what gets recorded.
   ========================================================================== */

window.WW = window.WW || {};

(function (WW) {
'use strict';

const MIN = 1;
const MAX = 5;

const REGISTRY = {};

/**
 * Register a drawable scale.
 * { words, blurbs, hint, axis, valueAt(x, y), draw(v) }
 *
 * `valueAt` receives the pointer in viewBox units and returns an unclamped
 * value — each scale decides its own mapping, because they are not all a
 * plain axis (the squeeze maps from distance to centre, not from y).
 */
function defineScale(name, spec) { REGISTRY[name] = spec; }

/** a -> 1, b -> 5. The common linear case. */
function lerp15(a, b) {
  return (t) => 1 + ((t - a) / (b - a)) * (MAX - MIN);
}

function build(root, spec, name) {
  const clamp = (v) => Math.min(MAX, Math.max(MIN, v));
  let value = clamp(Number(root.dataset.value) || 3);
  let dragging = false;

  const stage = document.createElement('div');
  stage.className = 'dragscale__stage';
  stage.setAttribute('role', 'slider');
  stage.setAttribute('tabindex', '0');
  stage.setAttribute('aria-label', root.dataset.label || spec.label || name);
  stage.setAttribute('aria-valuemin', String(MIN));
  stage.setAttribute('aria-valuemax', String(MAX));
  stage.setAttribute('aria-orientation', spec.axis === 'x' ? 'horizontal' : 'vertical');

  const readout = document.createElement('p');
  readout.className = 'dragscale__readout';

  const blurb = document.createElement('p');
  blurb.className = 'dragscale__blurb';

  const scale = document.createElement('div');
  scale.className = 'dragscale__scale';
  scale.setAttribute('aria-hidden', 'true');   // the slider already announces the value
  scale.innerHTML = spec.words.slice(1)
    .map((w, i) => `<button class="dragscale__tick" type="button"
                      data-set="${i + 1}" tabindex="-1">${w}</button>`).join('');

  const hint = document.createElement('p');
  hint.className = 'dragscale__hint';
  hint.innerHTML = `${WW.icon('sparkle', { size: 14 })}<span>${spec.hint}</span>`;

  root.append(stage, readout, blurb, scale, hint);

  function paint() {
    stage.innerHTML = spec.draw(value);
    stage.setAttribute('aria-valuenow', String(value));
    stage.setAttribute('aria-valuetext', spec.words[value]);
    root.dataset.value = String(value);
    readout.textContent = spec.words[value];
    blurb.textContent = spec.blurbs[value];
    scale.querySelectorAll('[data-set]').forEach((b) => {
      b.classList.toggle('is-on', Number(b.dataset.set) === value);
    });
  }

  function emit(type) {
    root.dispatchEvent(new CustomEvent(type, {
      bubbles: true,
      detail: { name, value, label: spec.words[value] },
    }));
  }

  function setValue(v) {
    const next = clamp(v);
    if (next === value) return;
    value = next;
    paint();
    emit('ww:scale');
  }

  /* --- Pointer: mouse, touch and pen through one path ------------------ */

  function pointerValue(e) {
    const svg = stage.querySelector('svg');
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 200;      // to viewBox units
    const y = ((e.clientY - r.top) / r.height) * 200;
    return clamp(Math.round(spec.valueAt(x, y)));
  }

  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    stage.classList.add('is-dragging');
    // Capture is an optimisation, not a requirement — never let it abort.
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* no capture */ }
    setValue(pointerValue(e));
    e.preventDefault();
  });

  stage.addEventListener('pointermove', (e) => {
    if (dragging) setValue(pointerValue(e));
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('is-dragging');
    try {
      if (stage.hasPointerCapture?.(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    } catch (err) { /* already released */ }
    emit('ww:scalecommit');
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  /* --- Keyboard: the standard slider contract -------------------------- */

  stage.addEventListener('keydown', (e) => {
    let next = null;
    switch (e.key) {
      case 'ArrowUp': case 'ArrowRight': next = value + 1; break;
      case 'ArrowDown': case 'ArrowLeft': next = value - 1; break;
      case 'PageUp': next = value + 2; break;
      case 'PageDown': next = value - 2; break;
      case 'Home': next = MIN; break;
      case 'End': next = MAX; break;
      default: return;
    }
    e.preventDefault();
    setValue(next);
    emit('ww:scalecommit');
  });

  scale.addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]');
    if (!b) return;
    setValue(Number(b.dataset.set));
    emit('ww:scalecommit');
  });

  paint();
  return { get value() { return value; }, setValue };
}

function initDragScale(root) {
  const name = root.dataset.scale;
  const spec = REGISTRY[name];
  if (!spec) return null;
  root.classList.add('dragscale', 'dragscale--' + name);
  return build(root, spec, name);
}

WW.defineScale = defineScale;
WW.initDragScale = initDragScale;
WW.lerp15 = lerp15;

WW.onReady(function () {
  document.querySelectorAll('[data-scale]').forEach(initDragScale);
});

})(window.WW);
