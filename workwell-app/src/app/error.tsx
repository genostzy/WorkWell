'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Brandmark } from '@/components/brandmark'

/**
 * A root-level screen that threw — sign-in, set-password, the landing room.
 *
 * These sit outside (app)/, so there is no shell to fail inside and this
 * carries the standalone notice frame instead, the same one the 404 uses.
 * Without it these errors would fall all the way through to global-error,
 * which replaces the whole document and is a much colder page than the
 * situation usually deserves.
 */
export default function RootError({
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
    <main className="notice">
      <div className="notice__inner">
        <div className="notice__brand">
          <Brandmark size={30} />
          <span className="notice__wordmark">WorkWell</span>
        </div>

        <div className="card">
          <div className="state state--error">
            <div className="state__icon" aria-hidden="true">
              ⚠️
            </div>
            <h1 className="state__title">Something went wrong</h1>
            <p className="state__text">
              This screen failed to load. Nothing has been lost, and your
              account is unaffected — trying again is usually enough.
            </p>
            <div className="state__actions">
              <button className="btn btn--primary" onClick={reset}>
                Try again
              </button>
              <Link className="btn btn--secondary" href="/sign-in">
                Go to sign in
              </Link>
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
  )
}
