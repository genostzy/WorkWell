/**
 * Showing and hiding the sky, which React does not own.
 *
 * sky.js builds its element once, on script load, and closes over the nodes
 * it made — `WW.sky.paint` writes to those exact nodes. That has one
 * consequence that cost us the background: removing the element does not
 * un-mount the script, it orphans it. paint() carries on writing to detached
 * nodes for as long as the tab lives, and nothing ever puts a new sky in the
 * document, so the office came back with no sky behind it.
 *
 * So the element stays and its visibility is what moves. `body.has-sky` is
 * still what the rest of the CSS keys off — it makes the body transparent
 * and lifts the room above the sky layer — and it must come off with the
 * sky, or an ordinary screen renders over nothing.
 */

function skyEl() {
  return document.querySelector<HTMLElement>('.sky')
}

export function showSky() {
  const el = skyEl()
  if (el) el.hidden = false
  document.body.classList.add('has-sky')
  // Repaint on the way in: the sky is a clock face as much as a backdrop,
  // and its own interval may not have come round since we left.
  window.WW?.sky?.paint()
}

export function hideSky() {
  const el = skyEl()
  if (el) el.hidden = true
  document.body.classList.remove('has-sky')
}
