/* WW.onReady, which the vendored scripts expect.
 *
 * In the prototype it lives in app.js, alongside the whole multi-page shell
 * — sidebar injection, routing, the account menu — none of which belongs in
 * a React app. This is the one function of that file the scales actually
 * need, kept separate so dragscale.js and scales.js can stay byte-identical
 * to the prototype's and be re-synced without thinking.
 *
 * next/script loads these after the document is interactive, so the callback
 * almost always runs immediately; the listener is for the case where it does
 * not. */
window.WW = window.WW || {};

window.WW.onReady = function (fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
};
