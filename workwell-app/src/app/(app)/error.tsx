'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * A screen inside the app that threw.
 *
 * Renders in the children slot of (app)/layout.tsx, so the sidebar, the
 * topbar and the room's own navigation all survive: one page failing
 * should cost you that page, not the way out of it. That is the whole
 * reason this sits here rather than only at the root.
 *
 * The wording is the same promise LoadError makes, for the same reason —
 * a read that failed is not data that is gone, and the difference decides
 * whether someone waits or starts re-entering work they have already done.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Next logs this server-side already; this is what puts it in the
    // browser console too, where whoever is looking at the screen can
    // actually read it. There is no error-reporting service wired up yet.
    console.error(error)
  }, [error])

  return (
    <div className="card">
      <div className="state state--error">
        <div className="state__icon" aria-hidden="true">
          ⚠️
        </div>
        <h1 className="state__title">This screen could not be shown</h1>
        <p className="state__text">
          Something failed while building this page. Nothing has been lost —
          this is a screen failing, not your data going missing. Trying again
          is usually enough.
        </p>
        <div className="state__actions">
          <button className="btn btn--primary" onClick={reset}>
            Try again
          </button>
          <Link className="btn btn--secondary" href="/">
            Back to your room
          </Link>
        </div>
        {/* The digest is the only handle on a production error whose real
            message is stripped before it reaches the browser. Worth
            showing, quietly, so it can be quoted to whoever can look it
            up in the server logs. */}
        {error.digest && (
          <p className="t-subtle mt-3">
            <code>{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  )
}
