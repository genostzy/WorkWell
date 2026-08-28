'use client'

import { useEffect } from 'react'

// This file replaces the root layout when it renders, so none of the
// layout's imports have run — the stylesheets have to be pulled in here or
// the page arrives as unstyled HTML. Only the three that matter for a
// single centred card; there is no shell, sidebar or room to dress.
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/components.css'

/**
 * The root layout itself failed.
 *
 * The last resort, and the only error screen that has to supply its own
 * <html> and <body>: React has unmounted everything above it. That also
 * means next/font never ran, so the type falls back through --font-sans to
 * Quicksand and then the system stack. Worth knowing rather than fixing —
 * re-declaring the font here would download it during the one render where
 * the app is already in trouble.
 *
 * Deliberately has no link anywhere. Whatever broke sits above every route
 * in the app, so offering a route is offering something that will most
 * likely break the same way; a reload is the only honest action here.
 *
 * Renders in production only — in development Next shows its own error
 * overlay instead, which is the more useful screen while building.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <main className="notice">
          <div className="notice__inner">
            <div className="card">
              <div className="state state--error">
                <div className="state__icon" aria-hidden="true">
                  ⚠️
                </div>
                <h1 className="state__title">WorkWell could not start</h1>
                <p className="state__text">
                  Something failed before any screen could be drawn. Nothing
                  has been lost — none of your data is touched by this. If
                  reloading does not clear it, the problem is at our end and
                  not something you can fix from here.
                </p>
                <div className="state__actions">
                  <button className="btn btn--primary" onClick={reset}>
                    Reload
                  </button>
                </div>
                {error.digest && (
                  <p className="t-subtle mt-3">
                    <code>{error.digest}</code>
                  </p>
                )}
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
