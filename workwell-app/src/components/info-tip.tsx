'use client'

import { useState } from 'react'

/**
 * A "?" that reveals a short sentence on hover, keyboard focus, or a tap.
 *
 * Hover/focus-within alone (the original, state-free version of this) never
 * opens on iOS Safari: tapping a plain <button> there does not reliably move
 * DOM focus to it, so :focus-within never fires and there is no hover on a
 * touchscreen either — the sentence this carries, previously always visible,
 * became unreachable by touch on that platform. A click handler doesn't have
 * that problem; click fires on tap everywhere. Kept as a small dedicated
 * client component, not folded into chrome.tsx, so the rest of that file
 * (used directly by server-rendered pages) doesn't have to become a client
 * boundary just because this one piece needs state.
 */
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className={open ? 'tip tip--open' : 'tip'}>
      <button
        type="button"
        className="info-dot tip__trigger"
        aria-label={text}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      <span className="tip__bubble" role="tooltip">
        {text}
      </span>
    </span>
  )
}
