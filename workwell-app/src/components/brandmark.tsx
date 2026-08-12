'use client'

import { useId } from 'react'

/**
 * The WorkWell mark, ported from the prototype's icons.js.
 *
 * The colours come from tokens in `style` rather than fill/stroke
 * attributes: Chrome resolves var() in a presentation attribute but support
 * is not uniform, and the failure is silent — the shape just paints black.
 *
 * The clip path needs a document-unique id because the mark appears more
 * than once on a page, and duplicate ids collapse to a single clip. useId
 * supplies one that matches between server and client, which is also why
 * this leaf is a client component — hooks do not run in a server one.
 */
export function Brandmark({
  size = 34,
  label,
}: {
  size?: number
  label?: string
}) {
  // useId's value carries punctuation (`:r0:`, `«r0»` depending on the
  // React version) that has no business inside a url(#…) reference. Strip
  // it rather than trusting every browser to tolerate it.
  const clip = `ww-mark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      {...(label
        ? { role: 'img', 'aria-label': label }
        : { 'aria-hidden': true, focusable: false })}
    >
      <defs>
        <clipPath id={clip}>
          <rect width="32" height="32" rx="3.4" />
        </clipPath>
      </defs>
      <rect width="32" height="32" rx="3.4" style={{ fill: 'var(--accent)' }} />
      <g
        clipPath={`url(#${clip})`}
        strokeWidth="3.3"
        style={{ fill: 'none', stroke: 'var(--text-on-accent)' }}
      >
        <path d="M-2 6.6 L 7.6 19.2 L 15.6 8.4 L 28.8 34" />
        <path d="M21.5 10.5 L 25.9 5.8 L 34 16.7" />
      </g>
      <path
        style={{ fill: 'var(--text-on-accent)' }}
        d="M7.4 7.35C5.15 5.75 4.85 4.3 5.55 3.4c.73-.92 1.57-.5 1.85.15.28-.65 1.12-1.07 1.85-.15.7.9.4 2.35-1.85 3.95Z"
      />
    </svg>
  )
}

/**
 * The product name with the company behind it.
 *
 * Stacked rather than run on one line: at a size small enough not to
 * compete with the name, "by AxionHR" set beside it collides with the
 * name's own descenders and is the first thing to disappear on a narrow
 * screen. Above the fold of the name it stays legible at 11px.
 */
export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span className="wordmark">
      <Brandmark size={size} />
      <span className="wordmark__text">
        <span className="wordmark__name">WorkWell</span>
        <span className="wordmark__by">by AxionHR</span>
      </span>
    </span>
  )
}
